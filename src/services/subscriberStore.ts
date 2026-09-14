import { todayDateKey } from '../prompts/dates.js';
import { getLoadedPromptConfig } from '../prompts/loader.js';

const DEFAULT_TIMEZONE = 'Asia/Singapore';

type DailyRecord = {
  primarySentAt?: number;
  alternateUsed: boolean;
};

const subscribers = new Set<number>();
const dailyState = new Map<string, DailyRecord>();

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const STATE_TTL_DAYS = 14;

function stateKey(chatId: number, dateKey: string): string {
  return `${chatId}:${dateKey}`;
}

function getDateKey(): string {
  try {
    return todayDateKey(getLoadedPromptConfig().timezone);
  } catch {
    return todayDateKey(DEFAULT_TIMEZONE);
  }
}

function getRecord(chatId: number, dateKey: string): DailyRecord {
  const key = stateKey(chatId, dateKey);
  const existing = dailyState.get(key);
  if (existing) {
    return existing;
  }
  const created: DailyRecord = { alternateUsed: false };
  dailyState.set(key, created);
  return created;
}

export function subscribe(chatId: number): void {
  subscribers.add(chatId);
}

export function unsubscribe(chatId: number): void {
  subscribers.delete(chatId);
}

export function isSubscribed(chatId: number): boolean {
  return subscribers.has(chatId);
}

export function listSubscribers(): number[] {
  return [...subscribers];
}

export function markPrimarySent(chatId: number, dateKey?: string): void {
  const key = dateKey ?? getDateKey();
  const record = getRecord(chatId, key);
  record.primarySentAt = Date.now();
}

export function wasPrimarySentToday(chatId: number, dateKey?: string): boolean {
  const key = dateKey ?? getDateKey();
  return Boolean(getRecord(chatId, key).primarySentAt);
}

export function canUseAlternate(chatId: number, dateKey?: string): boolean {
  const key = dateKey ?? getDateKey();
  return !getRecord(chatId, key).alternateUsed;
}

export function consumeAlternate(chatId: number, dateKey?: string): void {
  const key = dateKey ?? getDateKey();
  getRecord(chatId, key).alternateUsed = true;
}

export function removeSubscriber(chatId: number): void {
  unsubscribe(chatId);
}

function purgeOldState(): void {
  const cutoff = Date.now() - STATE_TTL_DAYS * 24 * 60 * 60 * 1000;
  for (const [key, record] of dailyState.entries()) {
    const sentAt = record.primarySentAt ?? 0;
    if (sentAt > 0 && sentAt < cutoff) {
      dailyState.delete(key);
    }
  }
}

const cleanupTimer = setInterval(() => {
  purgeOldState();
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

export function subscriberCountForTests(): number {
  return subscribers.size;
}

export function resetSubscriberStoreForTests(): void {
  subscribers.clear();
  dailyState.clear();
}
