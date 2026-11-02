import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { validationFailed } from '@/lib/http/errors';
import { reorderServicesBody } from '@/lib/schemas/services';
import * as services from '@/lib/repositories/services';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * POST /api/admin/services/reorder — sets the display order of every service.
 *
 * The body is the whole list in its new order, so a move is one request and
 * the result does not depend on what else was moved. A list that leaves out a
 * service, or names one that does not exist, is a 422: the screen it came from
 * is out of date.
 */
export default createRoute({
  POST: {
    body: reorderServicesBody,
    roles: ['admin', 'editor'],
    permission: 'services:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      if (!(await services.reorder(body.ids))) {
        throw validationFailed(
          [{ field: 'ids', message: 'Must list every service exactly once; reload and try again' }],
          'Invalid request body',
        );
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.SERVICES_REORDERED,
        entityType: 'service',
        changes: { order: body.ids },
        ipAddress: ip,
      });

      await invalidatePrefix('services');

      return { results: await services.listAll() };
    },
  },
});
