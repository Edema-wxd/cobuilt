import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { notFound, validationFailed } from '@/lib/http/errors';
import { reorderImagesBody } from '@/lib/schemas/gallery';
import * as gallery from '@/lib/repositories/gallery';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * POST /api/admin/gallery/[albumId]/images/reorder — sets the order of every
 * image in an album. As with albums, the body is the whole list; one that
 * leaves out an image, or names one from another album, is a 422.
 */

const params = z.object({ albumId: z.string().uuid() });

export default createRoute({
  POST: {
    query: params,
    body: reorderImagesBody,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const album = await gallery.findById(query.albumId);
      if (!album) throw notFound('Album not found');

      if (!(await gallery.reorderImages(album.id, body.ids))) {
        throw validationFailed(
          [{ field: 'ids', message: 'Must list every image in the album exactly once; reload and try again' }],
          'Invalid request body',
        );
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_IMAGES_REORDERED,
        entityType: 'gallery_album',
        entityId: album.id,
        changes: { order: body.ids },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return { results: await gallery.imagesFor(album.id) };
    },
  },
});
