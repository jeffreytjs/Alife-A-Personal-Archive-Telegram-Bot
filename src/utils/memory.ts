/**
 * Per-user conversation memory and rate limiting.
 */
import { config } from './config.js';
import { ensureDbReady, getDbPool } from './db.js';

export interface RateLimitState {
  windowStart: number;
  messageCount: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  messageCount: number;
  limit: number;
  windowStart: number;
  retryAfterMs: number;
}

export interface MessageMemory {
  userId: number;
  username?: string;
  firstName?: string;
  messages: Array<{
    timestamp: number;
    role: 'user' | 'assistant';
    content: string;
    messageType?: 'text' | 'command' | 'callback' | 'web_app_data';
  }>;
}

type UserMemoryRow = {
  user_id: string | number;
  username: string | null;
  first_name: string | null;
  messages_json: unknown;
};

const db = getDbPool();
const rateLimitState = new Map<number, RateLimitState>();

const MEMORY_CLEANUP_INTERVAL = 60 * 60 * 1000;
const MAX_MEMORY_AGE = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function parseJsonOrDefault<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) {
    return fallback;
  }

  if (typeof raw === 'string') {
    if (raw.trim() === '') {
      return fallback;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  return raw as T;
}

function fromRow(row: UserMemoryRow | undefined): MessageMemory | null {
  if (!row) {
    return null;
  }

  const userId = Number(row.user_id);
  if (!Number.isFinite(userId)) {
    return null;
  }

  const messages = parseJsonOrDefault<MessageMemory['messages']>(row.messages_json, []);

  const memory: MessageMemory = {
    userId,
    messages: Array.isArray(messages) ? messages : [],
  };

  if (row.username) memory.username = row.username;
  if (row.first_name) memory.firstName = row.first_name;

  return memory;
}

async function persistMemory(memory: MessageMemory): Promise<void> {
  await ensureDbReady();

  await db.query(
    `
      INSERT INTO user_memory (
        user_id,
        username,
        first_name,
        messages_json,
        updated_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT(user_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        messages_json = EXCLUDED.messages_json,
        updated_at = EXCLUDED.updated_at
    `,
    [
      memory.userId,
      memory.username ?? null,
      memory.firstName ?? null,
      JSON.stringify(memory.messages),
      Date.now(),
    ],
  );
}

async function ensureUserMemory(
  userId: number,
  userInfo?: { username?: string; firstName?: string },
): Promise<MessageMemory> {
  const existing = await getUserMemory(userId);
  if (existing) {
    if (userInfo?.username) existing.username = userInfo.username;
    if (userInfo?.firstName) existing.firstName = userInfo.firstName;
    return existing;
  }

  const created: MessageMemory = {
    userId,
    messages: [],
  };

  if (userInfo?.username) created.username = userInfo.username;
  if (userInfo?.firstName) created.firstName = userInfo.firstName;

  await persistMemory(created);
  return created;
}

function getMaxMessages(): number {
  return config.app.maxConversationHistory * 2;
}

export async function initializeMemoryStore(): Promise<void> {
  await ensureDbReady();
}

export async function addMessage(
  userId: number,
  role: 'user' | 'assistant',
  content: string,
  messageType: 'text' | 'command' | 'callback' | 'web_app_data' = 'text',
  userInfo?: { username?: string; firstName?: string },
): Promise<void> {
  const memory = await ensureUserMemory(userId, userInfo);

  memory.messages.push({
    timestamp: Date.now(),
    role,
    content: content.trim(),
    messageType,
  });

  if (memory.messages.length > getMaxMessages()) {
    memory.messages = memory.messages.slice(-getMaxMessages());
  }

  await persistMemory(memory);
}

export function checkAndUpdateRateLimit(userId: number): RateLimitCheckResult {
  const now = Date.now();
  const limit = config.app.rateLimitMessagesPerMinute;
  const existing = rateLimitState.get(userId);

  if (!existing || now - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    const nextState: RateLimitState = {
      windowStart: now,
      messageCount: 1,
    };
    rateLimitState.set(userId, nextState);

    return {
      allowed: true,
      messageCount: nextState.messageCount,
      limit,
      windowStart: nextState.windowStart,
      retryAfterMs: 0,
    };
  }

  if (existing.messageCount >= limit) {
    return {
      allowed: false,
      messageCount: existing.messageCount,
      limit,
      windowStart: existing.windowStart,
      retryAfterMs: Math.max(0, RATE_LIMIT_WINDOW_MS - (now - existing.windowStart)),
    };
  }

  existing.messageCount += 1;
  rateLimitState.set(userId, existing);

  return {
    allowed: true,
    messageCount: existing.messageCount,
    limit,
    windowStart: existing.windowStart,
    retryAfterMs: 0,
  };
}

export async function getConversationHistory(
  userId: number,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const memory = await getUserMemory(userId);
  if (!memory) return [];

  return memory.messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function getUserMemory(userId: number): Promise<MessageMemory | null> {
  await ensureDbReady();
  const result = await db.query<UserMemoryRow>(
    `
      SELECT user_id, username, first_name, messages_json
      FROM user_memory
      WHERE user_id = $1
    `,
    [userId],
  );

  return fromRow(result.rows[0]);
}

export async function clearUserMemory(userId: number): Promise<void> {
  await ensureDbReady();
  await db.query('DELETE FROM user_memory WHERE user_id = $1', [userId]);
  rateLimitState.delete(userId);
}

export async function cleanupOldMemories(): Promise<void> {
  await ensureDbReady();

  const now = Date.now();
  const staleRows = await db.query<{ user_id: string | number }>(
    'SELECT user_id FROM user_memory WHERE updated_at < $1',
    [now - MAX_MEMORY_AGE],
  );

  if (staleRows.rows.length > 0) {
    await db.query('DELETE FROM user_memory WHERE updated_at < $1', [now - MAX_MEMORY_AGE]);

    for (const row of staleRows.rows) {
      const userId = Number(row.user_id);
      if (Number.isFinite(userId)) {
        rateLimitState.delete(userId);
      }
    }
  }

  for (const [userId, state] of rateLimitState.entries()) {
    if (now - state.windowStart > MAX_MEMORY_AGE) {
      rateLimitState.delete(userId);
    }
  }
}

setInterval(() => {
  void cleanupOldMemories().catch((error) => {
    console.error('Failed to clean up old memories:', error);
  });
}, MEMORY_CLEANUP_INTERVAL);
