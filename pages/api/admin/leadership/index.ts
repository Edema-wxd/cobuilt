import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { createLeaderBody } from '@/lib/schemas/leadership';
import * as leadership from '@/lib/repositories/leadership';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeLeaderForAdmin } from '@/lib/serializers';

/**
 * /api/admin/leadership
 *   GET  — every leader, drafts included, in running order
 *   POST — create a leader (a draft unless `published` is true)
 *
 * Writes clear the `leadership` cache prefix, so /api/leadership answers with
 * the change at once and the pages within their one-minute revalidation.
 */
export default createRoute({
  GET: {
    roles: ['admin', 'editor'],
    permission: 'leadership:write',
    handler: async () => ({
      results: (await leadership.listAllLeadership()).map(serializeLeaderForAdmin),
    }),
  },

  POST: {
    body: createLeaderBody,
    roles: ['admin', 'editor'],
    permission: 'leadership:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      let leader;
      try {
        leader = await leadership.createLeader(body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('A leader with that web address already exists');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.LEADER_CREATED,
        entityType: 'leader',
        entityId: leader.id,
        changes: { fullName: leader.full_name, slug: leader.slug, published: leader.published },
        ipAddress: ip,
      });

      await invalidatePrefix('leadership');

      return created(serializeLeaderForAdmin(leader));
    },
  },
});
