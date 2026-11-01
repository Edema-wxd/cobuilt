import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, notFound } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { updateLeaderBody } from '@/lib/schemas/leadership';
import * as leadership from '@/lib/repositories/leadership';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeLeaderForAdmin } from '@/lib/serializers';

/**
 * /api/admin/leadership/[leaderId]
 *   GET    — one leader, draft or published
 *   PATCH  — editor/admin update; only the fields sent change
 *   DELETE — admin only; removes the profile
 */

const params = z.object({ leaderId: z.string().uuid() });

export default createRoute({
  GET: {
    query: params,
    roles: ['admin', 'editor'],
    permission: 'leadership:write',
    handler: async ({ query }) => {
      const leader = await leadership.getLeaderById(query.leaderId);
      if (!leader) throw notFound('Leader not found');
      return serializeLeaderForAdmin(leader);
    },
  },

  PATCH: {
    query: params,
    body: updateLeaderBody,
    roles: ['admin', 'editor'],
    permission: 'leadership:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      let updated;
      try {
        updated = await leadership.updateLeader(query.leaderId, body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('A leader with that web address already exists');
        }
        throw error;
      }
      if (!updated) throw notFound('Leader not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.LEADER_UPDATED,
        entityType: 'leader',
        entityId: updated.id,
        changes: {
          fields: Object.keys(body),
          // Publication and the spotlight are the changes worth reading at a glance.
          ...(body.published !== undefined ? { published: body.published } : {}),
          ...(body.featured !== undefined ? { featured: body.featured } : {}),
        },
        ipAddress: ip,
      });

      await invalidatePrefix('leadership');

      return serializeLeaderForAdmin(updated);
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'leadership:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await leadership.deleteLeader(query.leaderId);
      if (!removed) throw notFound('Leader not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.LEADER_DELETED,
        entityType: 'leader',
        entityId: removed.id,
        changes: { fullName: removed.full_name, slug: removed.slug },
        ipAddress: ip,
      });

      await invalidatePrefix('leadership');

      return noContent();
    },
  },
});
