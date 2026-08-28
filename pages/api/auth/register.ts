import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { registerBody } from '@/lib/schemas/auth';
import { conflict, forbidden } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { env } from '@/lib/env';
import * as users from '@/lib/repositories/users';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeUser } from '@/lib/serializers';

/**
 * POST /api/auth/register — creates an admin-surface account.
 *
 * This is not public sign-up. Phase 1 has no investor accounts (§10), so
 * registration requires an authenticated admin unless ALLOW_PUBLIC_REGISTRATION
 * is set — which exists only to bootstrap the very first admin in a fresh
 * environment, and must stay false in production.
 */
export default createRoute({
  POST: {
    body: registerBody,
    rateLimit: RATE_LIMITS.login,
    auth: 'optional',
    csrf: false,
    handler: async ({ body, auth, ip }) => {
      const isAdmin = auth?.role === 'admin';

      if (!isAdmin && !env.ALLOW_PUBLIC_REGISTRATION) {
        throw forbidden('Account creation is restricted to administrators');
      }

      // Only an admin may mint another admin; self-registration during
      // bootstrap cannot escalate beyond the default role it asks for.
      if (body.role === 'admin' && !isAdmin && !env.ALLOW_PUBLIC_REGISTRATION) {
        throw forbidden('Only an administrator can create an admin account');
      }

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
        actorId: auth?.userId ?? null,
        actorEmail: auth?.email ?? null,
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: 'user',
        entityId: user.id,
        changes: { email: user.email, role: user.role, selfRegistered: !isAdmin },
        ipAddress: ip,
      });

      return created({ user: serializeUser(user) });
    },
  },
});
