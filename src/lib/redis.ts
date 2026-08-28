import Redis from 'ioredis';
import { env, isProduction, isTest } from './env';
import { logger } from './logger';

/**
 * Redis connection shared by the cache, rate limiter and queue producers.
 *
 * Redis is a performance dependency, not a correctness one: every caller
 * degrades gracefully when it is down (cache misses through to PostgreSQL,
 * the rate limiter fails closed on a per-route basis). So the client never
 * throws on connection failure — it reports unavailability instead.
 */

declare global {
  var __cobuiltRedis: Redis | undefined;
}

function createClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    // Without this, every module import would open a socket — including in
    // unit tests that never touch Redis.
    lazyConnect: true,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
  });

  client.on('error', (err) => {
    logger.warn('Redis error', { error: err.message });
  });

  if (!isTest) {
    client.connect().catch((err: Error) => {
      logger.warn('Redis initial connection failed; continuing degraded', {
        error: err.message,
      });
    });
  }

  return client;
}

export const redis: Redis = globalThis.__cobuiltRedis ?? createClient();
if (!isProduction) globalThis.__cobuiltRedis = redis;

export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

export async function checkRedis(): Promise<boolean> {
  if (!isRedisReady()) return false;
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}
