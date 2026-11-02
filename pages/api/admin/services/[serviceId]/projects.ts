import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { notFound, validationFailed } from '@/lib/http/errors';
import { setServiceProjectsBody, type SetServiceProjectsBody } from '@/lib/schemas/services';
import * as services from '@/lib/repositories/services';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * PUT /api/admin/services/[serviceId]/projects — replaces the projects shown on
 * a service page, in order, each optionally marked as a case study.
 *
 * Draft projects may be attached; the public page shows a project only while
 * it is published, so an editor can line one up before it goes live.
 */

const params = z.object({ serviceId: z.string().uuid() });

export default createRoute({
  PUT: {
    query: params,
    body: setServiceProjectsBody,
    roles: ['admin', 'editor'],
    permission: 'services:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const service = await services.findById(query.serviceId);
      if (!service) throw notFound('Service not found');

      const projects: SetServiceProjectsBody['projects'] = body.projects;
      const { missing } = await services.setProjects(service.id, projects);
      if (missing.length > 0) {
        throw validationFailed(
          missing.map((id) => ({
            field: `projects.${projects.findIndex((p) => p.projectId === id)}.projectId`,
            message: 'No such project',
          })),
          'Invalid request body',
        );
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.SERVICE_PROJECTS_UPDATED,
        entityType: 'service',
        entityId: service.id,
        changes: {
          projectIds: projects.map((p) => p.projectId),
          caseStudyIds: projects.filter((p) => p.caseStudy).map((p) => p.projectId),
        },
        ipAddress: ip,
      });

      await invalidatePrefix('services');

      return { results: await services.projectsFor(service.id) };
    },
  },
});
