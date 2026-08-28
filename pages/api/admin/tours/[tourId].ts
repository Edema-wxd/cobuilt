import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound } from '@/lib/http/errors';
import { logger } from '@/lib/logger';
import { deleteObject } from '@/lib/storage/s3';
import * as tours from '@/lib/repositories/tours';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/** DELETE /api/admin/tours/[tourId] — removes a tour and its stored asset. */
export default createRoute({
  DELETE: {
    query: z.object({ tourId: z.string().uuid() }),
    roles: ['admin'],
    permission: 'tours:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await tours.remove(query.tourId);
      if (!removed) throw notFound('Tour not found');

      if (removed.model_file_s3_key) {
        // The database row is already gone; a failed object delete leaves an
        // orphaned file, which is a cleanup problem rather than a request
        // failure worth surfacing to the operator.
        await deleteObject(removed.model_file_s3_key).catch((error: Error) => {
          logger.error('Failed to delete tour asset from storage', {
            key: removed.model_file_s3_key,
            error: error.message,
          });
        });
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.TOUR_DELETED,
        entityType: 'virtual_tour',
        entityId: query.tourId,
        changes: { projectId: removed.project_id, key: removed.model_file_s3_key },
        ipAddress: ip,
      });

      return noContent();
    },
  },
});
