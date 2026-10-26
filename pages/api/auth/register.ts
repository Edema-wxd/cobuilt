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
 * POST /api/auth/register — an administrator invites someone by email.
 *
 * This creates the application account (role and permissions) but no
 * credentials. The person signs up in Neon Auth with the same address at
 * /admin/register, verifies it, and the two are linked on their first request.
 * Until then the account cannot be signed in to by anyone else: linking
 * requires an address Neon Auth has verified.
 */
export default createRoute({
  POST: {
    body: registerBody,
    rateLimit: RATE_LIMITS.api,
    auth: 'required',
    roles: ['admin'],
    permission: 'users:write',
    csrf: false,
    handler: async ({ body, auth, ip }) => {
      let user;
      try {
        user = await users.create({
          email: body.email,
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
