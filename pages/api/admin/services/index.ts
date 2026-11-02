import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { createServiceBody } from '@/lib/schemas/services';
import * as services from '@/lib/repositories/services';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/services
 *   GET  — every service, drafts included, in display order
 *   POST — create a service, at the end of the list and unpublished by default
 *
 * Public pages read `/api/services`; this is the console's view.
 */
export default createRoute({
  GET: {
    roles: ['admin', 'editor'],
    permission: 'services:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => ({ results: await services.listAll() }),
  },

  POST: {
    body: createServiceBody,
    roles: ['admin', 'editor'],
    permission: 'services:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      let service;
      try {
        service = await services.create(body);
      } catch (error) {
        // The slug is disambiguated on create, so a clash here is the title,
        // which doubles as the project filter label and must be unique.
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('A service with that title already exists');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.SERVICE_CREATED,
        entityType: 'service',
        entityId: service.id,
        changes: { title: service.title, slug: service.slug, published: service.published },
        ipAddress: ip,
      });

      await invalidatePrefix('services');

      return created(service);
    },
  },
});
