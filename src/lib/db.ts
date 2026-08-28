import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { env, isProduction } from './env';
import { logger } from './logger';

/**
 * PostgreSQL access. A single pool is shared per process and cached on
 * globalThis so Next.js hot reloads in development do not leak connections.
 */

declare global {
  var __cobuiltPgPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
  });

  // An idle-client error is emitted outside any query; without this handler
  // Node treats it as an unhandled 'error' event and kills the process.
  pool.on('error', (err) => {
    logger.error('Idle PostgreSQL client error', { error: err.message });
  });

  return pool;
}

export const pool: Pool = globalThis.__cobuiltPgPool ?? createPool();
if (!isProduction) globalThis.__cobuiltPgPool = pool;

const SLOW_QUERY_MS = 500;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  const startedAt = Date.now();
  try {
    const result = await pool.query<T>(text, params as unknown[]);
    const durationMs = Date.now() - startedAt;

    if (durationMs > SLOW_QUERY_MS) {
      logger.warn('Slow query', { durationMs, sql: text.replace(/\s+/g, ' ').slice(0, 200) });
    }

    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } catch (error) {
    // The SQL text is safe to log (parameters are not interpolated into it);
    // the parameters themselves may carry personal data, so they are omitted.
    logger.error('Query failed', {
      error: error instanceof Error ? error.message : String(error),
      sql: text.replace(/\s+/g, ' ').slice(0, 200),
    });
    throw error;
  }
}

/** Returns the first row, or null when the query matched nothing. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a transaction, committing on success and rolling back on
 * any thrown error. The client is always released, including when the rollback
 * itself fails.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Rollback failed', {
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Postgres error codes the API translates into meaningful HTTP responses. */
export const PG_ERROR = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
} as const;

export function isPgError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
