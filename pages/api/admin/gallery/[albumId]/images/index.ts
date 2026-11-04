import { z } from 'zod';
import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, notFound, serviceUnavailable, validationFailed } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { isStorageConfigured, lookupFile } from '@/lib/storage/uploadthing';
import { addImagesBody, type AddImagesBody } from '@/lib/schemas/gallery';
import * as gallery from '@/lib/repositories/gallery';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * POST /api/admin/gallery/[albumId]/images — adds images to the end of an
 * album, up to 20 at once, each with its alt text.
 *
 * An image is either a file the console has just uploaded to UploadThing
 * (`galleryImage`), named by its key, or a link. An uploaded file is only
 * accepted once it is confirmed present in storage, as a tour's model is, so
 * an upload that never finished cannot leave an image pointing at nothing.
 * The batch is all or nothing.
 */

const params = z.object({ albumId: z.string().uuid() });

export default createRoute({
  POST: {
    query: params,
    body: addImagesBody,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const album = await gallery.findById(query.albumId);
      if (!album) throw notFound('Album not found');

      const requested: AddImagesBody['images'] = body.images;
      const uploads = requested.filter((image) => image.fileKey);
      if (uploads.length > 0 && !isStorageConfigured()) {
        throw serviceUnavailable('Object storage is not configured');
      }

      const resolved = await Promise.all(
        requested.map(async (image) => {
          if (!image.fileKey) return { url: image.imageUrl!, found: true };
          const file = await lookupFile(image.fileKey);
          return { url: file.url ?? '', found: file.exists };
        }),
      );

      const missing = resolved.flatMap((file, index) => (file.found ? [] : [index]));
      if (missing.length > 0) {
        throw validationFailed(
          missing.map((index) => ({
            field: `images.${index}.fileKey`,
            message: 'No uploaded file found for that key; complete the upload first',
          })),
          'Invalid request body',
        );
      }

      let images;
      try {
        images = await gallery.addImages(
          album.id,
          requested.map((image, index) => ({
            url: resolved[index]!.url,
            fileKey: image.fileKey ?? null,
            altText: image.altText,
            caption: image.caption ?? null,
            width: image.width ?? null,
            height: image.height ?? null,
            takenOn: image.takenOn ?? null,
          })),
        );
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('That uploaded file is already in the gallery');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_IMAGES_ADDED,
        entityType: 'gallery_album',
        entityId: album.id,
        changes: {
          imageIds: images.map((image) => image.id),
          uploaded: uploads.length,
          linked: requested.length - uploads.length,
        },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return created({ results: images });
    },
  },
});
