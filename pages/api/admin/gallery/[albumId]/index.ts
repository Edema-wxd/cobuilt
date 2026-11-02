import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, notFound, validationFailed } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { logger } from '@/lib/logger';
import { deleteFiles } from '@/lib/storage/uploadthing';
import { updateAlbumBody } from '@/lib/schemas/gallery';
import * as gallery from '@/lib/repositories/gallery';
import * as projects from '@/lib/repositories/projects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/gallery/[albumId]
 *   GET    — the album with every image, in order
 *   PATCH  — update; `published: false` takes it off the public site, and
 *            `coverImageId` picks the card's image from the album's own
 *   DELETE — admin only; removes the album, its images and their stored files
 *
 * Unpublishing is the everyday way to retire an album: it keeps the images for
 * later. Deleting is final.
 */

const params = z.object({ albumId: z.string().uuid() });

function fieldError(field: string, message: string) {
  return validationFailed([{ field, message }], 'Invalid request body');
}

export default createRoute({
  GET: {
    query: params,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const album = await gallery.findDetail(query.albumId);
      if (!album) throw notFound('Album not found');
      return album;
    },
  },

  PATCH: {
    query: params,
    body: updateAlbumBody,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const existing = await gallery.findById(query.albumId);
      if (!existing) throw notFound('Album not found');

      if (body.projectId && !(await projects.exists(body.projectId))) {
        throw fieldError('projectId', 'No such project');
      }
      if (body.coverImageId && !(await gallery.imageInAlbum(existing.id, body.coverImageId))) {
        throw fieldError('coverImageId', 'The cover must be one of this album’s images');
      }

      let updated;
      try {
        updated = await gallery.update(existing.id, body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('Another album already has that web address');
        }
        throw error;
      }
      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Album not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_ALBUM_UPDATED,
        entityType: 'gallery_album',
        entityId: existing.id,
        changes: {
          fields: Object.keys(body),
          // Publication and the address are what change the public site, so
          // the trail says which way they went.
          ...(body.published !== undefined && body.published !== existing.published
            ? { published: body.published }
            : {}),
          ...(body.slug !== undefined && body.slug !== existing.slug
            ? { previousSlug: existing.slug, slug: body.slug }
            : {}),
        },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return { ...updated, images: await gallery.imagesFor(updated.id) };
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await gallery.remove(query.albumId);
      if (!removed) throw notFound('Album not found');

      // As for a tour: the rows are already gone, so a failed delete leaves
      // orphaned files to clean up, not a request failure to report.
      await deleteFiles(removed.fileKeys).catch((error: Error) => {
        logger.error('Failed to delete gallery files from storage', {
          albumId: removed.id,
          keys: removed.fileKeys,
          error: error.message,
        });
      });

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_ALBUM_DELETED,
        entityType: 'gallery_album',
        entityId: removed.id,
        changes: { title: removed.title, slug: removed.slug, keys: removed.fileKeys },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return noContent();
    },
  },
});
