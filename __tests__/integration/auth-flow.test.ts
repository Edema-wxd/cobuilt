import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query, queryOne } from '@/lib/db';
import * as users from '@/lib/repositories/users';
import * as forms from '@/lib/repositories/forms';
import {
  findRefreshToken,
  issueRefreshToken,
  purgeExpiredRefreshTokens,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from '@/lib/auth/refreshTokens';
import { verifyPassword } from '@/lib/auth/password';

describeWithDatabase('authentication flows', () => {
  let userId: string;

  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    const user = await users.create({
      email: 'editor@cobuilt.test',
      password: 'a-sufficiently-long-password',
      fullName: 'Test Editor',
      role: 'editor',
    });
    userId = user.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  const issue = () => issueRefreshToken({ userId, userAgent: 'jest', ipAddress: '102.89.44.0' });

  describe('refresh token rotation', () => {
    it('exchanges a valid token for a new one and revokes the old', async () => {
      const first = await issue();
      const rotated = await rotateRefreshToken({ token: first.token, userAgent: 'jest', ipAddress: null });

      expect(rotated).not.toBeNull();
      expect(rotated!.userId).toBe(userId);
      expect(rotated!.token).not.toBe(first.token);

      const old = await findRefreshToken(first.token);
      expect(old!.revoked_at).not.toBeNull();
      expect(old!.replaced_by).not.toBeNull();
    });

    it('rejects a token that has already been rotated', async () => {
      const first = await issue();
      await rotateRefreshToken({ token: first.token, userAgent: null, ipAddress: null });

      expect(
        await rotateRefreshToken({ token: first.token, userAgent: null, ipAddress: null }),
      ).toBeNull();
    });

    it('revokes the whole family when a rotated token is replayed', async () => {
      // A replay means the token was captured; every live session for that
      // user has to die, not just the replayed one.
      const first = await issue();
      const second = await rotateRefreshToken({ token: first.token, userAgent: null, ipAddress: null });
      const otherDevice = await issue();

      await rotateRefreshToken({ token: first.token, userAgent: null, ipAddress: null });

      expect(
        await rotateRefreshToken({ token: second!.token, userAgent: null, ipAddress: null }),
      ).toBeNull();
      expect(
        await rotateRefreshToken({ token: otherDevice.token, userAgent: null, ipAddress: null }),
      ).toBeNull();
    });

    it('rejects an unknown token', async () => {
      expect(
        await rotateRefreshToken({ token: 'f'.repeat(64), userAgent: null, ipAddress: null }),
      ).toBeNull();
    });

    it('rejects an expired token', async () => {
      const token = await issue();
      await query(
        `UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 hour' WHERE user_id = $1`,
        [userId],
      );

      expect(
        await rotateRefreshToken({ token: token.token, userAgent: null, ipAddress: null }),
      ).toBeNull();
    });

    it('stores only a hash, never the token itself', async () => {
      const token = await issue();
      const row = await queryOne<{ token_hash: string }>(
        `SELECT token_hash FROM refresh_tokens WHERE user_id = $1`,
        [userId],
      );

      expect(row!.token_hash).not.toBe(token.token);
      expect(row!.token_hash).toHaveLength(64);
    });

    it('logout revokes one session, not the others', async () => {
      const laptop = await issue();
      const phone = await issue();

      await revokeRefreshToken(laptop.token);

      expect(await rotateRefreshToken({ token: laptop.token, userAgent: null, ipAddress: null })).toBeNull();
      expect(await rotateRefreshToken({ token: phone.token, userAgent: null, ipAddress: null })).not.toBeNull();
    });

    it('does not end other sessions when a logged-out token is retried', async () => {
      // A stale browser tab retrying a logged-out token is ordinary; only a
      // token that was exchanged and then replayed indicates theft.
      const laptop = await issue();
      const phone = await issue();

      await revokeRefreshToken(laptop.token);
      await rotateRefreshToken({ token: laptop.token, userAgent: null, ipAddress: null });

      expect(
        await rotateRefreshToken({ token: phone.token, userAgent: null, ipAddress: null }),
      ).not.toBeNull();
    });

    it('revokeAllForUser ends every session', async () => {
      const laptop = await issue();
      const phone = await issue();

      await revokeAllForUser(userId);

      expect(await rotateRefreshToken({ token: laptop.token, userAgent: null, ipAddress: null })).toBeNull();
      expect(await rotateRefreshToken({ token: phone.token, userAgent: null, ipAddress: null })).toBeNull();
    });

    it('purges rows that can no longer authenticate anyone', async () => {
      await issue();
      await query(
        `UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '60 days' WHERE user_id = $1`,
        [userId],
      );

      expect(await purgeExpiredRefreshTokens()).toBe(1);
    });
  });

  describe('password reset', () => {
    it('issues a token and sets the new password', async () => {
      const reset = await users.createPasswordReset('editor@cobuilt.test');
      expect(reset).not.toBeNull();

      const updated = await users.consumePasswordReset(reset!.token, 'a-brand-new-password');
      expect(updated).not.toBeNull();

      const user = await queryOne<{ password_hash: string }>(
        `SELECT password_hash FROM users WHERE id = $1`,
        [userId],
      );
      await expect(verifyPassword('a-brand-new-password', user!.password_hash)).resolves.toBe(true);
    });

    it('rejects a reused reset token', async () => {
      const reset = await users.createPasswordReset('editor@cobuilt.test');
      await users.consumePasswordReset(reset!.token, 'a-brand-new-password');

      expect(await users.consumePasswordReset(reset!.token, 'another-password-here')).toBeNull();
    });

    it('rejects an expired reset token', async () => {
      const reset = await users.createPasswordReset('editor@cobuilt.test');
      await query(
        `UPDATE users SET password_reset_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
        [userId],
      );

      expect(await users.consumePasswordReset(reset!.token, 'another-password-here')).toBeNull();
    });

    it('returns null for an unknown address instead of signalling it', async () => {
      expect(await users.createPasswordReset('nobody@cobuilt.test')).toBeNull();
    });

    it('stores only a hash of the reset token', async () => {
      const reset = await users.createPasswordReset('editor@cobuilt.test');
      const row = await queryOne<{ password_reset_token_hash: string }>(
        `SELECT password_reset_token_hash FROM users WHERE id = $1`,
        [userId],
      );

      expect(row!.password_reset_token_hash).not.toBe(reset!.token);
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
          password: 'a-sufficiently-long-password',
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
        password: 'a-sufficiently-long-password',
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
