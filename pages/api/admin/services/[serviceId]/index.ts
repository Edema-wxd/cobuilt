import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, notFound } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { updateServiceBody } from '@/lib/schemas/services';
import * as services from '@/lib/repositories/services';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/services/[serviceId]
 *   GET    — the service with every attached project, drafts included
 *   PATCH  — update; `published: false` takes it off the public site
 *   DELETE — admin only; also removes the service from any project tagged with it
 *
 * Unpublishing is the everyday way to retire a service: it keeps the copy and
 * the attached projects for later. Deleting is final.
 */

const params = z.object({ serviceId: z.string().uuid() });

export default createRoute({
  GET: {
    query: params,
    roles: ['admin', 'editor'],
    permission: 'services:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const service = await services.findById(query.serviceId);
      if (!service) throw notFound('Service not found');
      return { ...service, projects: await services.projectsFor(service.id) };
    },
  },

  PATCH: {
    query: params,
    body: updateServiceBody,
    roles: ['admin', 'editor'],
    permission: 'services:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const existing = await services.findById(query.serviceId);
      if (!existing) throw notFound('Service not found');

      let updated;
      try {
        updated = await services.update(existing.id, body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('Another service already has that title or web address');
        }
        throw error;
      }
      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Service not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.SERVICE_UPDATED,
        entityType: 'service',
        entityId: existing.id,
        changes: {
          fields: Object.keys(body),
          // Publication and the address are what change the public site, so
          // the trail says which way they went.
          ...(body.published !== undefined && body.published !== existing.published
            ? { published: body.published }
            : {}),
          ...(body.slug !== undefined && body.slug !== existing.slug
            ? { previousSlug: existing.slug, slug: body.slug }
            : {}),
        },
        ipAddress: ip,
      });

      await invalidatePrefix('services');

      return { ...updated, projects: await services.projectsFor(updated.id) };
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'services:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await services.remove(query.serviceId);
      if (!removed) throw notFound('Service not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.SERVICE_DELETED,
        entityType: 'service',
        entityId: removed.id,
        changes: { title: removed.title, slug: removed.slug },
        ipAddress: ip,
      });

      // Project pages list their services by name, so theirs go too.
      await Promise.all([invalidatePrefix('services'), invalidatePrefix('projects')]);

      return noContent();
    },
  },
});
