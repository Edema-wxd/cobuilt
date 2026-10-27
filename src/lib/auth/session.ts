import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';
import { env } from '../env';
import { query, queryOne } from '../db';
import { forbidden, serviceUnavailable, unauthorized } from '../http/errors';
import { logger } from '../logger';
import type { UserRow } from '@/types/models';
import { effectivePermissions, type Permission, type Role } from './rbac';

/**
 * Request authentication on top of Neon Auth (Managed Better Auth).
 *
 * Neon Auth owns identity: sign-up, passwords, email verification and
 * sessions. It issues the browser a 15-minute EdDSA access token, which the
 * admin console sends as a bearer header. This module verifies that token
 * against the branch JWKS and resolves it to the application's own account in
 * `users`, which is where role, per-user permissions and deactivation live.
 * Being signed in to Neon Auth therefore grants nothing by itself.
 */

export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
  permissions: Set<Permission>;
}

export interface NeonIdentity {
  /** neon_auth."user".id */
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

let keySet: ReturnType<typeof createRemoteJWKSet> | undefined;

function keys(): ReturnType<typeof createRemoteJWKSet> {
  if (!env.NEON_AUTH_JWKS_URL || !env.NEON_AUTH_BASE_URL) {
    throw serviceUnavailable('Sign-in is not configured');
  }
  // jose caches the fetched keys and refetches when it meets an unknown kid.
  keySet ??= createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));
  return keySet;
}

/** Verifies a Neon Auth access token and returns the identity it asserts. */
export async function verifyNeonToken(token: string): Promise<NeonIdentity> {
  const keyResolver = keys();
  // The token's issuer and audience are the auth URL's origin, not its path.
  const origin = new URL(env.NEON_AUTH_BASE_URL!).origin;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, keyResolver, {
      // Pinning the algorithm blocks `alg: none` and key-confusion attacks.
      algorithms: ['EdDSA'],
      issuer: origin,
      audience: origin,
    }));
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) throw unauthorized('Token expired');
    if (error instanceof joseErrors.JWKSTimeout || error instanceof TypeError) {
      logger.error('Neon Auth JWKS unreachable', { error: String(error) });
      throw serviceUnavailable('Sign-in is temporarily unavailable');
    }
    throw unauthorized('Invalid token');
  }

  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw unauthorized('Invalid token claims');
  }

  return {
    id: payload.sub,
    email: payload.email,
    emailVerified: payload.emailVerified === true,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}

const COLUMNS = `
  id, email, full_name, role, permissions, is_active, email_verified,
  two_factor_enabled, created_at, last_login, updated_at, deleted_at, auth_user_id
`;

type AccountRow = UserRow & { auth_user_id: string | null };

/**
 * Finds the application account for an identity, linking it on first sign-in.
 *
 * An administrator creates an account by email (POST /api/auth/register); the
 * person then signs up with that address in Neon Auth. The two are joined here,
 * and only when Neon Auth has verified the address: linking on an unverified
 * email would let anyone who signs up with an administrator's address take the
 * account over.
 */
export async function resolveAccount(identity: NeonIdentity): Promise<AccountRow> {
  const linked = await queryOne<AccountRow>(
    `SELECT ${COLUMNS} FROM users WHERE auth_user_id = $1 AND deleted_at IS NULL`,
    [identity.id],
  );
  if (linked) return linked;

  if (!identity.emailVerified) {
    throw forbidden('Verify your email address to continue');
  }

  const claimed = await queryOne<AccountRow>(
    `UPDATE users
        SET auth_user_id = $1,
            email_verified = TRUE,
            full_name = coalesce(full_name, $3)
      WHERE lower(email) = lower($2) AND auth_user_id IS NULL AND deleted_at IS NULL
      RETURNING ${COLUMNS}`,
    [identity.id, identity.email, identity.name],
  );
  if (claimed) return claimed;

  throw forbidden('No CoBuilt account exists for this email. Ask an administrator to create one.');
}

/** Verifies a bearer token and resolves the account behind it. */
export async function authenticateBearer(token: string): Promise<AuthContext> {
  const identity = await verifyNeonToken(token);
  const account = await resolveAccount(identity);

  if (!account.is_active) throw forbidden('This account has been deactivated');

  // Hourly at most: every API call passes through here.
  await query(
    `UPDATE users SET last_login = NOW()
      WHERE id = $1 AND (last_login IS NULL OR last_login < NOW() - INTERVAL '1 hour')`,
    [account.id],
  );

  return {
    userId: account.id,
    email: account.email,
    role: account.role,
    // Read from the row on every request, so a role change or deactivation
    // takes effect immediately rather than when the token expires.
    permissions: effectivePermissions(account.role, account.permissions),
  };
}
