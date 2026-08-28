import bcrypt from 'bcryptjs';
import { timingSafeEqual, randomBytes, createHash } from 'node:crypto';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A bcrypt hash of a value that is never a real password, used to burn the
 * same CPU time when an account does not exist. Without it, login response
 * time reveals which email addresses are registered.
 */
const DUMMY_HASH = bcrypt.hashSync('cobuilt-timing-equaliser', BCRYPT_ROUNDS);

export async function burnPasswordComparison(): Promise<void> {
  await bcrypt.compare('cobuilt-timing-equaliser', DUMMY_HASH);
}

/**
 * Generates a single-use credential (password reset, email verification,
 * newsletter confirmation, refresh token).
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
