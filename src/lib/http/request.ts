import type { NextApiRequest } from 'next';
import { env } from '../env';

/**
 * Helpers for reading things off a request that are easy to get subtly wrong:
 * client IP behind a proxy chain, origin checks, and single-value query params.
 */

/**
 * Resolves the originating client IP.
 *
 * X-Forwarded-For is client-controlled, so only the *last* hop appended by our
 * own trusted proxy is meaningful. Cloudflare fronts this deployment (§11), so
 * CF-Connecting-IP is preferred and the leftmost XFF entry is used only as a
 * fallback — it is spoofable and must never be trusted for authorisation, only
 * for rate limiting and audit context.
 */
export function getClientIp(req: NextApiRequest): string | null {
  const cloudflare = header(req, 'cf-connecting-ip');
  if (cloudflare) return normaliseIp(cloudflare);

  const real = header(req, 'x-real-ip');
  if (real) return normaliseIp(real);

  const forwarded = header(req, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return normaliseIp(first);
  }

  return req.socket?.remoteAddress ? normaliseIp(req.socket.remoteAddress) : null;
}

/** Strips the IPv4-mapped IPv6 prefix so `::ffff:1.2.3.4` stores as `1.2.3.4`. */
function normaliseIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function header(req: NextApiRequest, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function getUserAgent(req: NextApiRequest): string | null {
  return header(req, 'user-agent');
}

/** Next.js gives `string | string[]` for every query param; collapse to one. */
export function queryParam(req: NextApiRequest, name: string): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return env.ALLOWED_ORIGINS.includes(origin);
}
