import { z } from 'zod';
import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember, invalidatePrefix } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import { createMilestoneBody, listMilestonesQuery } from '@/lib/schemas/passport';
import * as projects from '@/lib/repositories/projects';
import * as passport from '@/lib/repositories/passport';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeMilestone, serializeMilestoneForAdmin } from '@/lib/serializers';

/**
 * /api/projects/[idOrSlug]/passport
 *   GET  — public Project Passport(TM) timeline
 *   POST — admin/editor, record a milestone
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const params = z.object({ idOrSlug: z.string().min(1).max(255) });

async function resolve(idOrSlug: string, includeUnpublished: boolean) {
  const project = UUID_PATTERN.test(idOrSlug)
    ? await projects.findById(idOrSlug, { includeUnpublished })
    : await projects.findBySlug(idOrSlug, { includeUnpublished });

  if (!project) throw notFound('Project not found');
  return project;
}

export default createRoute({
  GET: {
    query: params.merge(listMilestonesQuery),
    rateLimit: RATE_LIMITS.api,
    auth: 'optional',
    // Milestones change more often than project copy, so they carry a shorter
    // CDN lifetime than the project detail response.
    cache: { sMaxAge: 1800, staleWhileRevalidate: 300 },
    handler: async ({ query, auth }) => {
      const isStaff = auth?.role === 'admin' || auth?.role === 'editor';
      const includeInternal = query.includeInternal && isStaff;

      const load = async () => {
        const project = await resolve(query.idOrSlug, isStaff);

        const [milestones, progress] = await Promise.all([
          passport.listForProject(project.id, {
            includeInternal,
            status: query.status,
          }),
          passport.progressForProject(project.id),
        ]);

        return { project, milestones, progress };
      };

      const data = includeInternal
        ? await load()
        : await remember(key('passport:list', { ...query, includeInternal: false }), TTL.passport, load);

      return {
        project: { id: data.project.id, title: data.project.title, slug: data.project.slug },
        passportEnabled: data.project.passport_enabled,
        progress: data.progress,
        milestones: data.milestones.map(
          includeInternal ? serializeMilestoneForAdmin : serializeMilestone,
        ),
      };
    },
  },

  POST: {
    query: params,
    body: createMilestoneBody,
    roles: ['admin', 'editor'],
    permission: 'passport:write',
    handler: async ({ query, body, auth, ip }) => {
      const project = await resolve(query.idOrSlug, true);
      const milestone = await passport.create(project.id, body, auth!.userId);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.MILESTONE_CREATED,
        entityType: 'passport_milestone',
        entityId: milestone.id,
        changes: { projectId: project.id, type: milestone.milestone_type, status: milestone.status },
        ipAddress: ip,
      });

      await invalidatePrefix('passport');

      return created(serializeMilestoneForAdmin(milestone));
    },
  },
});
