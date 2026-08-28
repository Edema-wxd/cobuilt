import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env';
import { unauthorized } from '../http/errors';
import { type Permission, type Role, isRole } from './rbac';

/**
 * Access tokens: stateless, short-lived (15 minutes per §4). Refresh tokens are
 * opaque random strings tracked in PostgreSQL — see ./refreshTokens.ts.
 */

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  role: Role;
  permissions: Permission[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export function signAccessToken(input: {
  userId: string;
  email: string;
  role: Role;
  permissions: readonly Permission[];
}): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    algorithm: 'HS256',
    subject: input.userId,
  };

  return jwt.sign(
    {
      email: input.email,
      role: input.role,
      permissions: [...input.permissions],
    },
    env.JWT_SECRET,
    options,
  );
}

export function verifyAccessToken(token: string): JWTPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      // Pinning the algorithm blocks the `alg: none` and RS256-to-HS256
      // confusion attacks.
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw unauthorized('Token expired');
    throw unauthorized('Invalid token');
  }

  if (!decoded || typeof decoded !== 'object') throw unauthorized('Invalid token');

  const payload = decoded as Record<string, unknown>;
  if (typeof payload.sub !== 'string' || !isRole(payload.role)) {
    throw unauthorized('Invalid token claims');
  }

  return payload as unknown as JWTPayload;
}

/** Extracts a bearer token from the Authorization header, if present. */
export function bearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const [scheme, ...rest] = authorization.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}
