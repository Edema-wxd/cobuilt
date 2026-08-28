import {
  effectivePermissions,
  hasPermission,
  isRole,
  permissionsForRole,
} from '@/lib/auth/rbac';

describe('RBAC', () => {
  it('gives admin every permission', () => {
    expect(permissionsForRole('admin')).toContain('users:write');
    expect(permissionsForRole('admin')).toContain('projects:delete');
  });

  it('lets an editor write but not delete, per the spec', () => {
    const editor = effectivePermissions('editor');
    expect(editor.has('projects:write')).toBe(true);
    expect(editor.has('projects:publish')).toBe(true);
    expect(editor.has('projects:delete')).toBe(false);
    expect(editor.has('news:delete')).toBe(false);
    expect(editor.has('users:write')).toBe(false);
  });

  it('gives a viewer read-only access', () => {
    const viewer = effectivePermissions('viewer');
    expect(viewer.has('projects:read')).toBe(true);
    expect(viewer.has('analytics:read')).toBe(true);
    expect(viewer.has('projects:write')).toBe(false);
  });

  it('gives the Phase 1 investor role no admin-surface permission', () => {
    expect(effectivePermissions('investor').size).toBe(0);
  });

  it('applies per-user grants', () => {
    const permissions = effectivePermissions('viewer', { grant: ['news:write'] });
    expect(permissions.has('news:write')).toBe(true);
  });

  it('lets a revocation beat both the role baseline and an explicit grant', () => {
    const permissions = effectivePermissions('editor', {
      grant: ['projects:delete'],
      revoke: ['projects:delete', 'news:write'],
    });
    expect(permissions.has('projects:delete')).toBe(false);
    expect(permissions.has('news:write')).toBe(false);
  });

  it('ignores unknown permission names in the overrides column', () => {
    const permissions = effectivePermissions('viewer', { grant: ['not:a:permission'] });
    expect([...permissions]).not.toContain('not:a:permission');
  });

  it('ignores a malformed permissions column instead of throwing', () => {
    expect(() => effectivePermissions('viewer', 'nonsense')).not.toThrow();
    expect(() => effectivePermissions('viewer', null)).not.toThrow();
  });

  it('checks a single permission', () => {
    expect(hasPermission('editor', {}, 'projects:write')).toBe(true);
    expect(hasPermission('editor', {}, 'projects:delete')).toBe(false);
  });

  it('validates role names', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('superuser')).toBe(false);
  });
});
