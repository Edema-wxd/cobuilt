import { randomBytes } from 'node:crypto';
import type { NextApiRequest } from 'next';
import { CSRF_COOKIE, readCookie } from '../auth/refreshTokens';
import { safeCompare } from '../auth/password';
import { forbidden } from './errors';
import { header } from './request';
import { env } from '../env';

/**
 * Double-submit cookie CSRF protection (§4).
 *
 * Only cookie-authenticated, state-changing requests need this. Requests
 * carrying a bearer token are not CSRF-able: a browser will not attach an
 * Authorization header on its own.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function generateCsrfToken(): string {
  return randomBytes(24).toString('hex');
}

export function assertCsrf(req: NextApiRequest): void {
  if (SAFE_METHODS.has(req.method ?? 'GET')) return;

  const cookieToken = readCookie(req, CSRF_COOKIE);
  const headerToken = header(req, 'x-csrf-token');

  if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken)) {
    throw forbidden('CSRF token missing or invalid');
  }

  // Origin is set by the browser and cannot be forged by page script, so it is
  // a second, independent check against a stolen-but-replayed token.
  const origin = header(req, 'origin');
  if (origin && !env.ALLOWED_ORIGINS.includes(origin)) {
    throw forbidden('Origin not allowed');
  }
}
