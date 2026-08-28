import { redis, isRedisReady } from './redis';
import { logger } from './logger';

/**
 * Redis-backed fixed-window rate limiter.
 *
 * The spec sketches `express-rate-limit` (§11), which cannot wrap a Next.js API
 * route — those handlers are `(req, res)` functions, not Express middleware
 * with a `next` callback. This implements the same limits directly against
 * Redis so the counters are shared across all app servers (§14 runs three).
 */

export interface RateLimitRule {
  /** Window length in seconds. */
  windowSeconds: number;
  /** Requests permitted per key per window. */
  max: number;
  /** Namespace, so two routes with the same client key do not share a counter. */
  bucket: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/** The limits named in §3 and §11. */
export const RATE_LIMITS = {
  api: { bucket: 'api', windowSeconds: 15 * 60, max: 100 },
  inquiry: { bucket: 'form:inquiry', windowSeconds: 60 * 60, max: 5 },
  newsletter: { bucket: 'form:newsletter', windowSeconds: 60, max: 1 },
  investment: { bucket: 'form:investment', windowSeconds: 60 * 60, max: 10 },
  login: { bucket: 'auth:login', windowSeconds: 15 * 60, max: 10 },
  passwordReset: { bucket: 'auth:reset', windowSeconds: 60 * 60, max: 5 },
  search: { bucket: 'search', windowSeconds: 60, max: 60 },
} as const satisfies Record<string, RateLimitRule>;

export async function consume(rule: RateLimitRule, key: string): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / 1000 / rule.windowSeconds) * rule.windowSeconds;
  const redisKey = `rate-limit:${rule.bucket}:${key}:${windowStart}`;

  if (!isRedisReady()) {
    // Fail open. Redis being down must not take the public website offline;
    // Cloudflare's edge rate limiting (§11) remains in force meanwhile.
    logger.warn('Rate limiter bypassed: Redis unavailable', { bucket: rule.bucket });
    return { allowed: true, limit: rule.max, remaining: rule.max, resetSeconds: 0 };
  }

  try {
    const results = await redis
      .multi()
      .incr(redisKey)
      // Only the first request in a window needs the TTL; NX keeps later
      // requests from extending the window and starving the client.
      .expire(redisKey, rule.windowSeconds, 'NX')
      .exec();

    const count = Number(results?.[0]?.[1] ?? 0);
    const resetSeconds = windowStart + rule.windowSeconds - Math.floor(Date.now() / 1000);

    return {
      allowed: count <= rule.max,
      limit: rule.max,
      remaining: Math.max(0, rule.max - count),
      resetSeconds: Math.max(1, resetSeconds),
    };
  } catch (error) {
    logger.warn('Rate limiter error; allowing request', {
      bucket: rule.bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: true, limit: rule.max, remaining: rule.max, resetSeconds: 0 };
  }
}

/** Clears a client's counter — used after a successful login. */
export async function reset(rule: RateLimitRule, key: string): Promise<void> {
  if (!isRedisReady()) return;
  const windowStart = Math.floor(Date.now() / 1000 / rule.windowSeconds) * rule.windowSeconds;
  await redis.del(`rate-limit:${rule.bucket}:${key}:${windowStart}`).catch(() => undefined);
}
