/**
 * Role-based access control (§4).
 *
 * Roles are not hierarchical by accident — each role's capabilities are listed
 * explicitly so that "editor cannot delete" is a property of the table rather
 * than of a numeric rank comparison someone will later get backwards.
 */

export const ROLES = ['admin', 'editor', 'viewer', 'investor'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'projects:read',
  'projects:write',
  'projects:publish',
  'projects:delete',
  'projects:approve_investor_content',
  'passport:write',
  'tours:write',
  'news:read',
  'news:write',
  'news:publish',
  'news:delete',
  'forms:read',
  'forms:moderate',
  'users:read',
  'users:write',
  'analytics:read',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  editor: [
    'projects:read',
    'projects:write',
    'projects:publish',
    'passport:write',
    'tours:write',
    'news:read',
    'news:write',
    'news:publish',
    'forms:read',
  ],
  // Read-only dashboard access for CoBuilt stakeholders.
  viewer: ['projects:read', 'news:read', 'forms:read', 'analytics:read'],
  // Phase 2. Carries no admin-surface permission in Phase 1.
  investor: [],
};

export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Resolves a user's effective permissions: the role's baseline, plus any
 * per-user grants and minus any per-user revocations from users.permissions.
 *
 * The JSONB column is shaped `{ "grant": [...], "revoke": [...] }`. Revocation
 * wins, so an explicitly revoked permission cannot be re-granted by role.
 */
export function effectivePermissions(
  role: Role,
  overrides: unknown = {},
): Set<Permission> {
  const result = new Set<Permission>(permissionsForRole(role));

  if (overrides && typeof overrides === 'object') {
    const { grant, revoke } = overrides as { grant?: unknown; revoke?: unknown };
    for (const p of asPermissionList(grant)) result.add(p);
    for (const p of asPermissionList(revoke)) result.delete(p);
  }

  return result;
}

function asPermissionList(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Permission =>
    typeof v === 'string' && (PERMISSIONS as readonly string[]).includes(v),
  );
}

export function hasPermission(
  role: Role,
  overrides: unknown,
  required: Permission,
): boolean {
  return effectivePermissions(role, overrides).has(required);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
