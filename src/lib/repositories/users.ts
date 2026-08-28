import { query, queryOne } from '../db';
import type { Paginated, UserRow } from '@/types/models';
import { paginate } from '@/types/models';
import type { Role } from '../auth/rbac';
import { hashPassword, generateToken, hashToken } from '../auth/password';

/** User account persistence. */

const PUBLIC_COLUMNS = `
  id, email, full_name, role, permissions, is_active, email_verified,
  two_factor_enabled, created_at, last_login, updated_at, deleted_at
`;

export async function findByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users
      WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [email],
  );
}

export async function findById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
}

export async function create(input: {
  email: string;
  password: string;
  fullName: string;
  role?: Role;
}): Promise<UserRow> {
  const passwordHash = await hashPassword(input.password);

  const row = await queryOne<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [input.email, passwordHash, input.fullName, input.role ?? 'viewer'],
  );

  return row!;
}

export async function recordLogin(id: string): Promise<void> {
  await query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [id]);
}

export async function list(options: {
  page: number;
  pageSize: number;
  role?: Role;
  isActive?: boolean;
}): Promise<Paginated<UserRow>> {
  const conditions = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (options.role) {
    params.push(options.role);
    conditions.push(`role = $${params.length}`);
  }
  if (options.isActive !== undefined) {
    params.push(options.isActive);
    conditions.push(`is_active = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize, offset);

  const { rows } = await query<UserRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM users ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM users ${where}`,
    params.slice(0, -2),
  );

  return paginate(rows, Number(total?.count ?? 0), options.page, options.pageSize);
}

export async function setRole(
  id: string,
  role: Role,
  permissions?: { grant?: string[]; revoke?: string[] },
): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `UPDATE users
        SET role = $2,
            permissions = coalesce($3::jsonb, permissions)
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${PUBLIC_COLUMNS}`,
    [id, role, permissions ? JSON.stringify(permissions) : null],
  );
}

export async function setActive(id: string, isActive: boolean): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `UPDATE users SET is_active = $2 WHERE id = $1 AND deleted_at IS NULL
     RETURNING ${PUBLIC_COLUMNS}`,
    [id, isActive],
  );
}

/**
 * Issues a password reset token. Returns null when the address is unknown; the
 * route still responds 200 so the endpoint cannot be used to enumerate
 * accounts.
 */
export async function createPasswordReset(
  email: string,
  ttlMinutes = 60,
): Promise<{ token: string; user: UserRow } | null> {
  const user = await findByEmail(email);
  if (!user || !user.is_active) return null;

  const { token, hash } = generateToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await query(
    `UPDATE users SET password_reset_token_hash = $2, password_reset_expires_at = $3
      WHERE id = $1`,
    [user.id, hash, expiresAt],
  );

  return { token, user };
}

/** Consumes a reset token and sets the new password. Returns the user, or null. */
export async function consumePasswordReset(
  token: string,
  newPassword: string,
): Promise<UserRow | null> {
  const passwordHash = await hashPassword(newPassword);

  return queryOne<UserRow>(
    `UPDATE users
        SET password_hash = $2,
            password_reset_token_hash = NULL,
            password_reset_expires_at = NULL
      WHERE password_reset_token_hash = $1
        AND password_reset_expires_at > NOW()
        AND deleted_at IS NULL
      RETURNING ${PUBLIC_COLUMNS}`,
    [hashToken(token), passwordHash],
  );
}

/** Soft delete plus deactivation, per the NDPA erasure flow (§11). */
export async function softDelete(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `UPDATE users
        SET is_active = FALSE,
            deleted_at = NOW(),
            -- Freeing the address lets the person re-register later, and
            -- removes the identifier from the live table.
            email = 'deleted+' || id::text || '@cobuilt.invalid',
            full_name = NULL
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${PUBLIC_COLUMNS}`,
    [id],
  );
}

export async function countByRole(): Promise<Array<{ role: string; count: number }>> {
  const { rows } = await query<{ role: string; count: string }>(
    `SELECT role::text AS role, count(*)::text AS count
       FROM users WHERE deleted_at IS NULL GROUP BY role`,
  );
  return rows.map((r) => ({ role: r.role, count: Number(r.count) }));
}
