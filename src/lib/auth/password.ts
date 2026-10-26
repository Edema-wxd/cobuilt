import { timingSafeEqual, randomBytes, createHash } from 'node:crypto';

/**
 * Generates a single-use credential (email verification, newsletter confirmation).
 *
 * The caller sends `token` to the user and stores only `hash`; a database dump
 * therefore yields nothing usable. SHA-256 rather than bcrypt is correct here:
 * the token is 256 bits of entropy, so it is not brute-forceable and the
 * lookup must stay fast enough to index.
 */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison for opaque tokens of equal length. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
