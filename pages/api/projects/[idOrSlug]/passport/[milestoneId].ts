import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import { updateMilestoneBody } from '@/lib/schemas/passport';
import * as passport from '@/lib/repositories/passport';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeMilestone, serializeMilestoneForAdmin } from '@/lib/serializers';

/**
 * /api/projects/[idOrSlug]/passport/[milestoneId]
 *   GET / PUT / DELETE for a single milestone.
 */

const params = z.object({
  idOrSlug: z.string().min(1).max(255),
  milestoneId: z.string().uuid(),
});

async function load(milestoneId: string) {
  const milestone = await passport.findById(milestoneId);
  if (!milestone) throw notFound('Milestone not found');
  return milestone;
}

export default createRoute({
  GET: {
    query: params,
    rateLimit: RATE_LIMITS.api,
    auth: 'optional',
    cache: { sMaxAge: 1800 },
    handler: async ({ query, auth }) => {
      const milestone = await load(query.milestoneId);
      const isStaff = auth?.role === 'admin' || auth?.role === 'editor';

      // An internal milestone must not be readable by URL guessing.
      if (!milestone.is_public && !isStaff) throw notFound('Milestone not found');

      return isStaff ? serializeMilestoneForAdmin(milestone) : serializeMilestone(milestone);
    },
  },

  PUT: {
    query: params,
    body: updateMilestoneBody,
    roles: ['admin', 'editor'],
    permission: 'passport:write',
    handler: async ({ query, body, auth, ip }) => {
      await load(query.milestoneId);
      const updated = await passport.update(query.milestoneId, body);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.MILESTONE_UPDATED,
        entityType: 'passport_milestone',
        entityId: query.milestoneId,
        changes: { fields: Object.keys(body) },
        ipAddress: ip,
      });

      await invalidatePrefix('passport');

      return serializeMilestoneForAdmin(updated!);
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'passport:write',
    handler: async ({ query, auth, ip }) => {
      const milestone = await load(query.milestoneId);
      await passport.remove(query.milestoneId);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.MILESTONE_DELETED,
        entityType: 'passport_milestone',
        entityId: query.milestoneId,
        changes: { projectId: milestone.project_id, type: milestone.milestone_type },
        ipAddress: ip,
      });

      await invalidatePrefix('passport');

      return noContent();
    },
  },
});
