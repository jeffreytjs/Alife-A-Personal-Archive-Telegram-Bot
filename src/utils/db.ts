/**
 * In-memory persistence for local development and small deployments.
 * Swap this module for Postgres when you need durable multi-instance storage.
 */

type QueryResult<T = unknown> = {
  rows: T[];
};

const memoryStore = new Map<number, Record<string, unknown>>();

export class Pool {
  constructor(_config?: unknown) {}

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
      return { rows: [] as T[] };
    }

    if (sql.includes('INSERT INTO user_memory')) {
      const userId = params?.[0] as number;
      memoryStore.set(userId, {
        user_id: userId,
        username: params?.[1],
        first_name: params?.[2],
        messages_json: params?.[3],
        updated_at: params?.[4],
      });
      return { rows: [] as T[] };
    }

    if (sql.includes('SELECT') && sql.includes('FROM user_memory') && sql.includes('WHERE user_id')) {
      const userId = params?.[0] as number;
      const row = memoryStore.get(userId);
      return { rows: (row ? [row] : []) as T[] };
    }

    if (sql.includes('SELECT user_id FROM user_memory WHERE updated_at')) {
      const threshold = params?.[0] as number;
      const rows: T[] = [];
      for (const [userId, row] of memoryStore.entries()) {
        if ((row.updated_at as number) < threshold) {
          rows.push({ user_id: userId } as T);
        }
      }
      return { rows };
    }

    if (sql.includes('DELETE FROM user_memory WHERE user_id')) {
      const userId = params?.[0] as number;
      memoryStore.delete(userId);
      return { rows: [] as T[] };
    }

    if (sql.includes('DELETE FROM user_memory WHERE updated_at')) {
      const threshold = params?.[0] as number;
      for (const [userId, row] of memoryStore.entries()) {
        if ((row.updated_at as number) < threshold) {
          memoryStore.delete(userId);
        }
      }
      return { rows: [] as T[] };
    }

    return { rows: [] as T[] };
  }
}

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

async function initializeSchema(): Promise<void> {
  console.log('Using in-memory user state (swap db.ts for Postgres in production if needed)');
}

export async function ensureDbReady(): Promise<void> {
  if (schemaInitialized) {
    return;
  }

  if (!schemaInitPromise) {
    schemaInitPromise = initializeSchema()
      .then(() => {
        schemaInitialized = true;
      })
      .catch((error) => {
        schemaInitPromise = null;
        throw error;
      });
  }

  await schemaInitPromise;
}

const pool = new Pool();

export function getDbPool(): Pool {
  return pool;
}
