import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember, invalidatePrefix } from '@/lib/cache';
import { listProjectsQuery, createProjectBody } from '@/lib/schemas/projects';
import * as projects from '@/lib/repositories/projects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeProject, serializeProjectForAdmin } from '@/lib/serializers';
import { enqueueSearch } from '@/lib/queues';
import { conflict } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';

/**
 * /api/projects
 *   GET  — public, paginated and filterable project list
 *   POST — admin/editor, create a project
 */
export default createRoute({
  GET: {
    query: listProjectsQuery,
    rateLimit: RATE_LIMITS.api,
    auth: 'optional',
    cache: { sMaxAge: 3600, staleWhileRevalidate: 600 },
    handler: async ({ query, auth }) => {
      // Drafts are only ever visible to a signed-in editor or admin, whatever
      // the client asks for.
      const canSeeDrafts =
        query.includeUnpublished && (auth?.role === 'admin' || auth?.role === 'editor');

      const load = () =>
        projects.listProjects({
          status: query.status,
          type: query.type,
          location: query.location,
          sector: query.sector,
          tag: query.tag,
          q: query.q,
          sort: query.sort,
          page: query.page,
          pageSize: query.pageSize,
          includeUnpublished: canSeeDrafts,
        });

      // Draft-inclusive results are per-user and must not enter the shared cache.
      const page = canSeeDrafts
        ? await load()
        : await remember(key('projects:list', { ...query, includeUnpublished: false }), TTL.projectList, load);

      return {
        ...page,
        results: page.results.map(canSeeDrafts ? serializeProjectForAdmin : serializeProject),
      };
    },
  },

  POST: {
    body: createProjectBody,
    roles: ['admin', 'editor'],
    permission: 'projects:write',
    handler: async ({ body, auth, ip }) => {
      let project;
      try {
        project = await projects.create(body, auth!.userId);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('A project with that slug already exists');
        }
        if (isPgError(error, PG_ERROR.FOREIGN_KEY_VIOLATION)) {
          throw conflict('Referenced taxonomy record does not exist');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.PROJECT_CREATED,
        entityType: 'project',
        entityId: project.id,
        changes: { title: project.title, slug: project.slug },
        ipAddress: ip,
      });

      await Promise.all([
        invalidatePrefix('projects'),
        enqueueSearch({ action: 'upsert', index: 'projects', id: project.id }),
      ]);

      return created(serializeProjectForAdmin(project));
    },
  },
});
