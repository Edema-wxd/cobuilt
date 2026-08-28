import type { NextApiRequest, NextApiResponse } from 'next';
import { query, queryOne, transaction } from '../db';
import { env, isProduction } from '../env';
import { logger } from '../logger';
import { generateToken, hashToken } from './password';

/**
 * Refresh tokens are opaque, single-use and stored hashed. Every refresh
 * rotates the token; presenting an already-rotated token is treated as theft
 * and revokes the whole family for that user.
 */

export const REFRESH_COOKIE = 'cobuilt_refresh';
export const CSRF_COOKIE = 'cobuilt_csrf';

interface RefreshRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  replaced_by: string | null;
}

export async function issueRefreshToken(input: {
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = generateToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.userId, hash, expiresAt, input.userAgent, input.ipAddress],
  );

  return { token, expiresAt };
}

/**
 * Validates and rotates a refresh token, returning the user it belongs to.
 * Returns null when the token is unknown, expired or revoked.
 */
export async function rotateRefreshToken(input: {
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<{ userId: string; token: string; expiresAt: Date } | null> {
  const hash = hashToken(input.token);

  return transaction(async (client) => {
    const { rows } = await client.query<RefreshRow>(
      `SELECT id, user_id, expires_at, revoked_at, replaced_by
         FROM refresh_tokens
        WHERE token_hash = $1
        FOR UPDATE`,
      [hash],
    );

    const existing = rows[0];
    if (!existing) return null;

    if (existing.revoked_at !== null) {
      // Distinguish two ways a token can be revoked. One that was *exchanged*
      // (replaced_by set) and is now presented again means a captured token is
      // being replayed, so every live session for that user is revoked. One
      // revoked by logout was never exchanged; a stale browser tab retrying it
      // is ordinary, and must not log the user out of their other devices.
      if (existing.replaced_by !== null) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [existing.user_id],
        );
        logger.warn('Refresh token reuse detected; revoked token family', {
          userId: existing.user_id,
        });
      }
      return null;
    }

    if (existing.expires_at.getTime() <= Date.now()) return null;

    const { token, hash: nextHash } = generateToken();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

    const { rows: inserted } = await client.query<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [existing.user_id, nextHash, expiresAt, input.userAgent, input.ipAddress],
    );

    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE id = $1`,
      [existing.id, inserted[0]?.id ?? null],
    );

    return { userId: existing.user_id, token, expiresAt };
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
      WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  );
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}

/** Removes rows that can no longer authenticate anyone. Called by the nightly job. */
export async function purgeExpiredRefreshTokens(): Promise<number> {
  const { rowCount } = await query(
    `DELETE FROM refresh_tokens
      WHERE expires_at < NOW() - INTERVAL '30 days'
         OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')`,
  );
  return rowCount;
}

export async function findRefreshToken(token: string): Promise<RefreshRow | null> {
  return queryOne<RefreshRow>(
    `SELECT id, user_id, expires_at, revoked_at, replaced_by
       FROM refresh_tokens WHERE token_hash = $1`,
    [hashToken(token)],
  );
}

/**
 * Sets the refresh cookie (HTTP-only) alongside a readable CSRF cookie. The
 * pair implements the double-submit pattern the spec requires (§4): the
 * browser cannot read the refresh token, and an attacker's cross-site request
 * cannot read the CSRF value to echo it back in a header.
 */
export function setAuthCookies(
  res: NextApiResponse,
  input: { refreshToken: string; expiresAt: Date; csrfToken: string },
): void {
  const maxAge = Math.max(0, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000));

  res.setHeader('Set-Cookie', [
    cookie(REFRESH_COOKIE, input.refreshToken, {
      httpOnly: true,
      maxAge,
      path: '/api/auth',
    }),
    cookie(CSRF_COOKIE, input.csrfToken, {
      httpOnly: false, // Read by the frontend to populate the X-CSRF-Token header
      maxAge,
      path: '/',
    }),
  ]);
}

export function clearAuthCookies(res: NextApiResponse): void {
  res.setHeader('Set-Cookie', [
    cookie(REFRESH_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/api/auth' }),
    cookie(CSRF_COOKIE, '', { httpOnly: false, maxAge: 0, path: '/' }),
  ]);
}

function cookie(
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAge: number; path: string },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    'SameSite=Strict',
  ];
  if (options.httpOnly) parts.push('HttpOnly');
  // Secure would make the cookie unusable over plain-HTTP local development.
  if (isProduction) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(req: NextApiRequest, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}
