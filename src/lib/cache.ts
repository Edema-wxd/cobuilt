import { redis, isRedisReady } from './redis';
import { logger } from './logger';

/**
 * Application cache (Layer 2 of §12). Every call falls through to the loader
 * when Redis is unavailable, so a cache outage costs latency, never
 * correctness.
 */

export const TTL = {
  projectList: 600, // 10 min
  projectDetail: 900, // 15 min
  passport: 300, // 5 min — milestones change more often than project copy
  news: 600,
  search: 300,
  facets: 900,
} as const;

export async function get<T>(key: string): Promise<T | null> {
  if (!isRedisReady()) return null;
  try {
    const cached = await redis.get(key);
    return cached === null ? null : (JSON.parse(cached) as T);
  } catch (error) {
    logger.warn('Cache read failed', { key, error: asMessage(error) });
    return null;
  }
}

export async function set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.warn('Cache write failed', { key, error: asMessage(error) });
  }
}

/** Read-through cache: returns the cached value or computes, stores and returns it. */
export async function remember<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) return cached;

  const value = await loader();
  await set(key, value, ttlSeconds);
  return value;
}

/**
 * Invalidates every key under a prefix.
 *
 * SCAN rather than KEYS: KEYS blocks the Redis event loop for the whole
 * keyspace, which on a shared cache stalls every other request.
 */
export async function invalidatePrefix(prefix: string): Promise<number> {
  if (!isRedisReady()) return 0;

  let cursor = '0';
  let removed = 0;

  try {
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        removed += await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    logger.warn('Cache invalidation failed', { prefix, error: asMessage(error) });
  }

  return removed;
}

/** Builds a stable cache key: object key order must not change the result. */
export function key(namespace: string, params: Record<string, unknown> = {}): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);

  return parts.length > 0 ? `${namespace}:${parts.join('&')}` : namespace;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
