import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import { approveInvestorContentBody } from '@/lib/schemas/projects';
import * as projects from '@/lib/repositories/projects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeProjectForAdmin } from '@/lib/serializers';

/**
 * POST /api/admin/projects/[projectId]/investor-approval — the legal sign-off
 * gate for investor content (§10).
 *
 * Until this is granted, the public project endpoint omits investment amount,
 * expected ROI and highlights entirely. Editing that content clears the
 * approval again (see repositories/projects.ts).
 */
export default createRoute({
  POST: {
    query: z.object({ projectId: z.string().uuid() }),
    body: approveInvestorContentBody,
    roles: ['admin'],
    permission: 'projects:approve_investor_content',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const existing = await projects.findById(query.projectId, { includeUnpublished: true });
      if (!existing) throw notFound('Project not found');

      const updated = await projects.setInvestorApproval(
        query.projectId,
        body.approved,
        auth!.userId,
      );

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: body.approved
          ? AUDIT_ACTIONS.INVESTOR_CONTENT_APPROVED
          : AUDIT_ACTIONS.INVESTOR_CONTENT_REVOKED,
        entityType: 'project',
        entityId: query.projectId,
        changes: { approved: body.approved, note: body.note ?? null },
        ipAddress: ip,
      });

      await invalidatePrefix('projects');

      return serializeProjectForAdmin(updated!);
    },
  },
});
