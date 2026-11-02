import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, validationFailed } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { createAlbumBody } from '@/lib/schemas/gallery';
import * as gallery from '@/lib/repositories/gallery';
import * as projects from '@/lib/repositories/projects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/gallery
 *   GET  — every album, drafts and empty ones included, in display order
 *   POST — create an album, at the end of the list and unpublished by default
 *
 * Images are added to an album once it exists, at
 * `/api/admin/gallery/[albumId]/images`. Public pages read `/api/gallery`.
 */
export default createRoute({
  GET: {
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => ({ results: await gallery.listAll() }),
  },

  POST: {
    body: createAlbumBody,
    roles: ['admin', 'editor'],
    permission: 'gallery:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      if (body.projectId && !(await projects.exists(body.projectId))) {
        throw validationFailed([{ field: 'projectId', message: 'No such project' }], 'Invalid request body');
      }

      let album;
      try {
        album = await gallery.create(body);
      } catch (error) {
        // The slug is disambiguated before the insert, so a clash here is a
        // concurrent create that took the same address first.
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('Another album already has that web address');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.GALLERY_ALBUM_CREATED,
        entityType: 'gallery_album',
        entityId: album.id,
        changes: {
          title: album.title,
          slug: album.slug,
          category: album.category,
          projectId: body.projectId,
          published: album.published,
        },
        ipAddress: ip,
      });

      await invalidatePrefix('gallery');

      return created(album);
    },
  },
});
