import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import { logger } from '@/lib/logger';
import { deleteFile } from '@/lib/storage/uploadthing';
import { updateImageBody } from '@/lib/schemas/gallery';
import * as gallery from '@/lib/repositories/gallery';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/gallery/[albumId]/images/[imageId]
 *   PATCH  — alt text, caption, date taken. The file itself is fixed: a
 *            different photograph is a new image.
 *   DELETE — removes the image and, for an upload, its stored file. Editors
 *            may: curating an album means removing frames, and the album
 *            itself stays.
 */

const params = z.object({ albumId: z.string().uuid(), imageId: z.string().uuid() });

export default createRoute({
  PATCH: {
    query: params,
    body: updateImageBody,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const updated = await gallery.updateImage(query.albumId, query.imageId, body);
      if (!updated) throw notFound('Image not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_IMAGE_UPDATED,
        entityType: 'gallery_image',
        entityId: updated.id,
        changes: { albumId: query.albumId, fields: Object.keys(body) },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return updated;
    },
  },

  DELETE: {
    query: params,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await gallery.removeImage(query.albumId, query.imageId);
      if (!removed) throw notFound('Image not found');

      if (removed.fileKey) {
        // The row is already gone; a failed object delete leaves an orphaned
        // file to clean up, not a request failure (as for a tour's model).
        await deleteFile(removed.fileKey).catch((error: Error) => {
          logger.error('Failed to delete gallery image from storage', {
            key: removed.fileKey,
            error: error.message,
          });
        });
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_IMAGE_DELETED,
        entityType: 'gallery_image',
        entityId: removed.id,
        changes: { albumId: query.albumId, key: removed.fileKey, url: removed.url },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return noContent();
    },
  },
});
