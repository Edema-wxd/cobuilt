import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, notFound, validationFailed } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { updateVideoBody } from '@/lib/schemas/videos';
import * as videos from '@/lib/repositories/videos';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/videos/[videoId]
 *   GET    — the video, whatever its state
 *   PATCH  — update; `published: false` takes it off the public site
 *   DELETE — admin only
 *
 * Unpublishing is the everyday way to retire a video: it keeps the entry for
 * later. Deleting is final, though the film itself stays on YouTube.
 */

const params = z.object({ videoId: z.string().uuid() });

export default createRoute({
  GET: {
    query: params,
    roles: ['admin', 'editor'],
    permission: 'videos:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const video = await videos.findById(query.videoId);
      if (!video) throw notFound('Video not found');
      return video;
    },
  },

  PATCH: {
    query: params,
    body: updateVideoBody,
    roles: ['admin', 'editor'],
    permission: 'videos:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const existing = await videos.findById(query.videoId);
      if (!existing) throw notFound('Video not found');

      // A project already linked may since have been deleted; only a change is checked.
      if (body.projectId && body.projectId !== existing.projectId && !(await videos.projectExists(body.projectId))) {
        throw validationFailed([{ field: 'projectId', message: 'No such project' }], 'Invalid request body');
      }

      let updated;
      try {
        updated = await videos.update(existing.id, body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('Another video already has that YouTube link or web address');
        }
        throw error;
      }
      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Video not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VIDEO_UPDATED,
        entityType: 'video',
        entityId: existing.id,
        changes: {
          fields: Object.keys(body),
          // Publication, the address and the film itself are what change the
          // public site, so the trail says which way they went.
          ...(body.published !== undefined && body.published !== existing.published
            ? { published: body.published }
            : {}),
          ...(body.slug !== undefined && body.slug !== existing.slug
            ? { previousSlug: existing.slug, slug: body.slug }
            : {}),
          ...(updated.youtubeId !== existing.youtubeId
            ? { previousYoutubeId: existing.youtubeId, youtubeId: updated.youtubeId }
            : {}),
        },
        ipAddress: ip,
      });

      await invalidatePrefix('videos');

      return updated;
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'videos:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await videos.remove(query.videoId);
      if (!removed) throw notFound('Video not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VIDEO_DELETED,
        entityType: 'video',
        entityId: removed.id,
        changes: { title: removed.title, slug: removed.slug, youtubeId: removed.youtubeId },
        ipAddress: ip,
      });

      await invalidatePrefix('videos');

      return noContent();
    },
  },
});
