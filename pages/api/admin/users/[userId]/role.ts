import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { changeRoleBody } from '@/lib/schemas/auth';
import { badRequest, notFound } from '@/lib/http/errors';
import * as users from '@/lib/repositories/users';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { revokeAllForUser } from '@/lib/auth/refreshTokens';
import { serializeUser } from '@/lib/serializers';

/** POST /api/admin/users/[userId]/role — change a user's role or permissions. */
export default createRoute({
  POST: {
    query: z.object({ userId: z.string().uuid() }),
    body: changeRoleBody,
    roles: ['admin'],
    permission: 'users:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      // Removing your own admin rights can leave a deployment with no
      // administrator at all, so it is refused rather than confirmed.
      if (query.userId === auth!.userId && body.role !== 'admin') {
        throw badRequest('You cannot remove your own admin role');
      }

      const before = await users.findById(query.userId);
      if (!before) throw notFound('User not found');

      const updated = await users.setRole(query.userId, body.role, body.permissions);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        entityType: 'user',
        entityId: query.userId,
        changes: { from: before.role, to: body.role, permissions: body.permissions ?? null },
        ipAddress: ip,
      });

      // Access tokens carry the old role until they expire; revoking the
      // refresh tokens ensures the change takes effect within 15 minutes and
      // the user cannot silently extend the old privileges.
      await revokeAllForUser(query.userId);

      return serializeUser(updated!);
    },
  },
});
