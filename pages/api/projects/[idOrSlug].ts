import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember, invalidatePrefix } from '@/lib/cache';
import { notFound, conflict } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { updateProjectBody } from '@/lib/schemas/projects';
import * as projects from '@/lib/repositories/projects';
import * as passport from '@/lib/repositories/passport';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeProject, serializeProjectForAdmin } from '@/lib/serializers';
import { enqueueSearch } from '@/lib/queues';

/**
 * /api/projects/[idOrSlug]
 *   GET    — public project detail, by slug (or UUID)
 *   PUT    — admin/editor update
 *   DELETE — admin soft delete
 *
 * The spec lists GET by `[slug]` and PUT/DELETE by `[projectId]` at the same
 * path (§3). Next.js allows only one parameter name per path segment, so the
 * segment accepts either form and the handler resolves it.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const params = z.object({ idOrSlug: z.string().min(1).max(255) });

async function resolveProject(idOrSlug: string, includeUnpublished: boolean) {
  return UUID_PATTERN.test(idOrSlug)
    ? projects.findById(idOrSlug, { includeUnpublished })
    : projects.findBySlug(idOrSlug, { includeUnpublished });
}

export default createRoute({
  GET: {
    query: params.extend({ includeUnpublished: z.coerce.boolean().default(false) }),
    rateLimit: RATE_LIMITS.api,
    auth: 'optional',
    cache: { sMaxAge: 3600, staleWhileRevalidate: 600 },
    handler: async ({ query, auth }) => {
      const canSeeDrafts =
        query.includeUnpublished && (auth?.role === 'admin' || auth?.role === 'editor');

      const load = async () => {
        const project = await resolveProject(query.idOrSlug, canSeeDrafts);
        if (!project) return null;

        // The passport summary ships with the detail response so the project
        // page renders its progress bar without a second round trip.
        const progress = project.passport_enabled
          ? await passport.progressForProject(project.id)
          : null;

        return { project, progress };
      };

      const data = canSeeDrafts
        ? await load()
        : await remember(key('projects:detail', { idOrSlug: query.idOrSlug }), TTL.projectDetail, load);

      if (!data) throw notFound('Project not found');

      return {
        ...(canSeeDrafts
          ? serializeProjectForAdmin(data.project)
          : serializeProject(data.project)),
        passportProgress: data.progress,
      };
    },
  },

  PUT: {
    query: params,
    body: updateProjectBody,
    roles: ['admin', 'editor'],
    permission: 'projects:write',
    handler: async ({ query, body, auth, ip }) => {
      const existing = await resolveProject(query.idOrSlug, true);
      if (!existing) throw notFound('Project not found');

      let updated;
      try {
        updated = await projects.update(existing.id, body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('A project with that slug already exists');
        }
        throw error;
      }

      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Project not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.PROJECT_UPDATED,
        entityType: 'project',
        entityId: existing.id,
        changes: { fields: Object.keys(body) },
        ipAddress: ip,
      });

      await Promise.all([
        invalidatePrefix('projects'),
        enqueueSearch({ action: 'upsert', index: 'projects', id: existing.id }),
      ]);

      return serializeProjectForAdmin(updated);
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'projects:delete',
    handler: async ({ query, auth, ip }) => {
      const existing = await resolveProject(query.idOrSlug, true);
      if (!existing) throw notFound('Project not found');

      await projects.softDelete(existing.id);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.PROJECT_DELETED,
        entityType: 'project',
        entityId: existing.id,
        changes: { title: existing.title, slug: existing.slug, softDelete: true },
        ipAddress: ip,
      });

      await Promise.all([
        invalidatePrefix('projects'),
        enqueueSearch({ action: 'delete', index: 'projects', id: existing.id }),
      ]);

      return noContent();
    },
  },
});
