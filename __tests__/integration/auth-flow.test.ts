import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, queryOne } from '@/lib/db';
import { inviteAdmin } from '@/lib/auth/bootstrap';
import * as users from '@/lib/repositories/users';
import * as forms from '@/lib/repositories/forms';
import { resolveAccount, type NeonIdentity } from '@/lib/auth/session';

describeWithDatabase('authentication flows', () => {
  let userId: string;

  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    const user = await users.create({
      email: 'editor@cobuilt.test',
      fullName: 'Test Editor',
      role: 'editor',
    });
    userId = user.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  const identity = (overrides: Partial<NeonIdentity> = {}): NeonIdentity => ({
    id: '9d1c1f6e-0f43-4a0e-9a57-0c8b3b2f6a11',
    email: 'editor@cobuilt.test',
    emailVerified: true,
    name: 'Test Editor',
    ...overrides,
  });

  describe('linking a Neon Auth identity', () => {
    it('links an invited account on the first verified sign-in', async () => {
      const account = await resolveAccount(identity());

      expect(account.id).toBe(userId);
      expect(account.role).toBe('editor');
      expect(account.auth_user_id).toBe(identity().id);
      expect(account.email_verified).toBe(true);
    });

    it('matches the invited address case-insensitively', async () => {
      const account = await resolveAccount(identity({ email: 'Editor@CoBuilt.test' }));
      expect(account.id).toBe(userId);
    });

    it('finds the account by identity once linked, even if the email changes', async () => {
      await resolveAccount(identity());
      const again = await resolveAccount(identity({ email: 'renamed@cobuilt.test' }));
      expect(again.id).toBe(userId);
    });

    it('refuses to link an unverified address', async () => {
      await expect(resolveAccount(identity({ emailVerified: false }))).rejects.toThrow(/verify/i);

      const row = await queryOne<{ auth_user_id: string | null }>(
        `SELECT auth_user_id FROM users WHERE id = $1`,
        [userId],
      );
      expect(row!.auth_user_id).toBeNull();
    });

    it('refuses an identity that is not linked to an account', async () => {
      await expect(resolveAccount(identity({ email: 'stranger@example.com' }))).rejects.toThrow(
        /no cobuilt account/i,
      );
    });

    it('does not let a second identity take over an already-linked account', async () => {
      await resolveAccount(identity());
      await expect(
        resolveAccount(identity({ id: '5b7a2d84-6f1e-4c53-8d0a-3a9e1f7c2b90' })),
      ).rejects.toThrow(/no cobuilt account/i);
    });
  });

  describe('inviting an administrator from the command line', () => {
    it('creates an admin account that links on the first verified sign-in', async () => {
      const result = await inviteAdmin({ email: 'First@CoBuilt.test', fullName: 'First Admin' });
      expect(result).toMatchObject({ status: 'invited', email: 'first@cobuilt.test' });

      const account = await resolveAccount(
        identity({ id: '5b7a2d84-6f1e-4c53-8d0a-3a9e1f7c2b90', email: 'first@cobuilt.test' }),
      );
      expect(account.role).toBe('admin');
    });

    it('leaves an existing account untouched', async () => {
      expect(await inviteAdmin({ email: 'editor@cobuilt.test', fullName: 'Someone' })).toEqual({
        status: 'exists',
        email: 'editor@cobuilt.test',
        role: 'editor',
      });
    });
  });

  describe('account erasure (NDPA)', () => {
    it('frees the address, deactivates the account and anonymises submissions', async () => {
      await forms.create({
        formType: 'inquiry',
        name: 'Test Editor',
        email: 'editor@cobuilt.test',
        message: 'An enquiry linked to this address.',
      });

      const deleted = await users.softDelete(userId);

      expect(deleted!.is_active).toBe(false);
      expect(deleted!.email).toContain('@cobuilt.invalid');
      expect(await users.findById(userId)).toBeNull();

      expect(await forms.anonymiseByEmail('editor@cobuilt.test')).toBe(1);

      // The address is released, so the person can register again.
      await expect(
        users.create({
          email: 'editor@cobuilt.test',
          fullName: 'Returning Editor',
          role: 'viewer',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('role changes', () => {
    it('applies a role change with per-user permission overrides', async () => {
      const updated = await users.setRole(userId, 'viewer', { grant: ['news:write'] });

      expect(updated!.role).toBe('viewer');
      expect(updated!.permissions).toEqual({ grant: ['news:write'] });
    });

    it('counts users by role for the dashboard', async () => {
      await users.create({
        email: 'admin@cobuilt.test',
        fullName: 'Test Admin',
        role: 'admin',
      });

      const counts = await users.countByRole();
      expect(counts).toEqual(
        expect.arrayContaining([
          { role: 'editor', count: 1 },
          { role: 'admin', count: 1 },
        ]),
      );
    });
  });
});
