import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { conflict, validationFailed } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { redirectsChanged } from '@/lib/redirects';
import { createRedirectBody } from '@/lib/schemas/redirects';
import * as redirects from '@/lib/repositories/redirects';
import { RedirectLoopError } from '@/lib/repositories/redirects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/redirects
 *   GET  — every rule, by source path, with its hit count
 *   POST — add a rule
 *
 * Admin only (`redirects:write`). A rule applies only where no page answers;
 * see docs/decisions.md §2.27.
 */
export default createRoute({
  GET: {
    roles: ['admin'],
    permission: 'redirects:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => ({ results: await redirects.listAll() }),
  },

  POST: {
    body: createRedirectBody,
    roles: ['admin'],
    permission: 'redirects:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      let redirect;
      try {
        redirect = await redirects.create(body, auth!.userId);
      } catch (error) {
        if (error instanceof RedirectLoopError) {
          throw validationFailed([{ field: error.field, message: error.message }], 'Invalid request body');
        }
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('That path already has a redirect; edit it instead');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.REDIRECT_CREATED,
        entityType: 'redirect',
        entityId: redirect.id,
        changes: {
          sourcePath: redirect.sourcePath,
          destination: redirect.destination,
          permanent: redirect.permanent,
        },
        ipAddress: ip,
      });

      await redirectsChanged(res, [redirect.sourcePath]);

      return created(redirect);
    },
  },
});
