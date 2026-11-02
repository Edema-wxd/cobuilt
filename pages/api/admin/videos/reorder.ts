import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { validationFailed } from '@/lib/http/errors';
import { reorderVideosBody } from '@/lib/schemas/videos';
import * as videos from '@/lib/repositories/videos';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * POST /api/admin/videos/reorder — sets the display order of every video.
 *
 * The body is the whole list in its new order, so a move is one request and
 * the result does not depend on what else was moved. A list that leaves out a
 * video, or names one that does not exist, is a 422: the screen it came from
 * is out of date.
 */
export default createRoute({
  POST: {
    body: reorderVideosBody,
    roles: ['admin', 'editor'],
    permission: 'videos:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      if (!(await videos.reorder(body.ids))) {
        throw validationFailed(
          [{ field: 'ids', message: 'Must list every video exactly once; reload and try again' }],
          'Invalid request body',
        );
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VIDEOS_REORDERED,
        entityType: 'video',
        changes: { order: body.ids },
        ipAddress: ip,
      });

      await invalidatePrefix('videos');

      return { results: await videos.listAll() };
    },
  },
});
