import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { registerBody } from '@/lib/schemas/auth';
import { conflict } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import * as users from '@/lib/repositories/users';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeUser } from '@/lib/serializers';

/**
 * POST /api/auth/register: an admin creates an admin-surface account.
 *
 * This is not public sign-up: Phase 1 has no investor accounts (§10). The
 * first admin in a fresh environment is created with
 * `npm run user:create-admin`, so this endpoint never needs to be opened up.
 */
export default createRoute({
  POST: {
    body: registerBody,
    rateLimit: RATE_LIMITS.login,
    roles: ['admin'],
    permission: 'users:write',
    handler: async ({ body, auth, ip }) => {
      let user;
      try {
        user = await users.create({
          email: body.email,
          password: body.password,
          fullName: body.fullName,
          role: body.role ?? 'viewer',
        });
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('An account with that email already exists');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: 'user',
        entityId: user.id,
        changes: { email: user.email, role: user.role },
        ipAddress: ip,
      });

      return created({ user: serializeUser(user) });
    },
  },
});
