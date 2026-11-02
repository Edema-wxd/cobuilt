import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { validationFailed } from '@/lib/http/errors';
import { reorderAlbumsBody } from '@/lib/schemas/gallery';
import * as gallery from '@/lib/repositories/gallery';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * POST /api/admin/gallery/reorder — sets the display order of every album.
 *
 * The body is the whole list in its new order, so a move is one request and
 * the result does not depend on what else was moved. A list that leaves out an
 * album, or names one that does not exist, is a 422: the screen it came from
 * is out of date.
 */
export default createRoute({
  POST: {
    body: reorderAlbumsBody,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      if (!(await gallery.reorder(body.ids))) {
        throw validationFailed(
          [{ field: 'ids', message: 'Must list every album exactly once; reload and try again' }],
          'Invalid request body',
        );
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_ALBUMS_REORDERED,
        entityType: 'gallery_album',
        changes: { order: body.ids },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return { results: await gallery.listAll() };
    },
  },
});
