import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, validationFailed } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { createVideoBody } from '@/lib/schemas/videos';
import * as videos from '@/lib/repositories/videos';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/videos
 *   GET  — every video, drafts included, in display order
 *   POST — add a video, at the end of the list and unpublished by default
 *
 * Public pages read `/api/videos`; this is the console's view.
 */
export default createRoute({
  GET: {
    roles: ['admin', 'editor'],
    permission: 'videos:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => ({ results: await videos.listAll() }),
  },

  POST: {
    body: createVideoBody,
    roles: ['admin', 'editor'],
    permission: 'videos:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      // Checked rather than left to the foreign key: a soft-deleted project
      // still satisfies the key, and the error should name the field.
      if (body.projectId && !(await videos.projectExists(body.projectId))) {
        throw validationFailed([{ field: 'projectId', message: 'No such project' }], 'Invalid request body');
      }

      let video;
      try {
        video = await videos.create(body);
      } catch (error) {
        // The slug is disambiguated on create, so a clash here is the video.
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('That YouTube video is already in the library');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VIDEO_CREATED,
        entityType: 'video',
        entityId: video.id,
        changes: {
          title: video.title,
          slug: video.slug,
          youtubeId: video.youtubeId,
          category: video.category,
          projectId: video.projectId,
          published: video.published,
        },
        ipAddress: ip,
      });

      await invalidatePrefix('videos');

      return created(video);
    },
  },
});
