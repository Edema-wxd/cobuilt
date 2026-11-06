import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { conflict, notFound, validationFailed } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { redirectsChanged } from '@/lib/redirects';
import { updateRedirectBody } from '@/lib/schemas/redirects';
import * as redirects from '@/lib/repositories/redirects';
import { RedirectLoopError } from '@/lib/repositories/redirects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/redirects/[redirectId]
 *   GET    — the rule
 *   PATCH  — change its source, destination or type; the hit count is kept
 *   DELETE — remove it; the old address is a 404 again
 *
 * Admin only (`redirects:write`).
 */

const params = z.object({ redirectId: z.string().uuid() });

export default createRoute({
  GET: {
    query: params,
    roles: ['admin'],
    permission: 'redirects:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const redirect = await redirects.findById(query.redirectId);
      if (!redirect) throw notFound('Redirect not found');
      return redirect;
    },
  },

  PATCH: {
    query: params,
    body: updateRedirectBody,
    roles: ['admin'],
    permission: 'redirects:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip, res }) => {
      const existing = await redirects.findById(query.redirectId);
      if (!existing) throw notFound('Redirect not found');

      let updated;
      try {
        updated = await redirects.update(existing.id, body);
      } catch (error) {
        if (error instanceof RedirectLoopError) {
          throw validationFailed([{ field: error.field, message: error.message }], 'Invalid request body');
        }
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('That path already has a redirect of its own');
        }
        throw error;
      }
      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Redirect not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.REDIRECT_UPDATED,
        entityType: 'redirect',
        entityId: existing.id,
        changes: {
          fields: Object.keys(body),
          ...(updated.sourcePath !== existing.sourcePath
            ? { previousSourcePath: existing.sourcePath, sourcePath: updated.sourcePath }
            : {}),
          ...(updated.destination !== existing.destination
            ? { previousDestination: existing.destination, destination: updated.destination }
            : {}),
          ...(updated.permanent !== existing.permanent ? { permanent: updated.permanent } : {}),
        },
        ipAddress: ip,
      });

      await redirectsChanged(res, [existing.sourcePath, updated.sourcePath]);

      return updated;
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'redirects:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip, res }) => {
      const removed = await redirects.remove(query.redirectId);
      if (!removed) throw notFound('Redirect not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.REDIRECT_DELETED,
        entityType: 'redirect',
        entityId: removed.id,
        changes: {
          sourcePath: removed.sourcePath,
          destination: removed.destination,
          hitCount: removed.hitCount,
        },
        ipAddress: ip,
      });

      await redirectsChanged(res, [removed.sourcePath]);

      return noContent();
    },
  },
});
