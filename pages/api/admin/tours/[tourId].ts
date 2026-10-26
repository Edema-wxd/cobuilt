import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { badRequest, notFound, serviceUnavailable, validationFailed } from '@/lib/http/errors';
import { logger } from '@/lib/logger';
import { deleteFile, isStorageConfigured, lookupFile } from '@/lib/storage/uploadthing';
import * as tours from '@/lib/repositories/tours';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeTourForAdmin } from '@/lib/serializers';
import { httpUrl } from '@/lib/schemas/common';

/**
 * /api/admin/tours/[tourId]
 *   PATCH  — editor/admin update
 *   DELETE — admin only; removes the tour and its stored asset
 */

const params = z.object({ tourId: z.string().uuid() });

/**
 * Every field is optional; null clears one. The format is fixed once a tour
 * exists — a different format is a different tour — so `tourType` is not
 * accepted, and which payload fields apply depends on the stored type.
 */
const updateBody = z
  .object({
    tourName: z.string().trim().min(2).max(255),
    modelKey: z.string().min(1).max(512),
    tourUrl: httpUrl.nullable(),
    embedCode: z.string().max(10_000).nullable(),
    thumbnailUrl: httpUrl.nullable(),
    description: z.string().max(5000).nullable(),
    featured: z.boolean(),
    published: z.boolean(),
  })
  .partial()
  .strict();

function fieldError(field: string, message: string) {
  return validationFailed([{ field, message }], 'Invalid request body');
}

export default createRoute({
  PATCH: {
    query: params,
    body: updateBody,
    roles: ['admin', 'editor'],
    permission: 'tours:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const existing = await tours.findById(query.tourId);
      if (!existing) throw notFound('Tour not found');

      const changes: tours.UpdateTourInput = {
        tourName: body.tourName,
        thumbnailUrl: body.thumbnailUrl,
        description: body.description,
        featured: body.featured,
        published: body.published,
      };
      let replacedKey: string | null = null;

      if (existing.tour_type === 'threejs_model') {
        // The URL of a Three.js tour is derived from its stored file, and it
        // has no embed, so only a new file changes either.
        if (body.tourUrl !== undefined) throw fieldError('tourUrl', 'Upload a new model file instead');
        if (body.embedCode !== undefined) throw fieldError('embedCode', 'A Three.js tour has no embed code');

        if (body.modelKey !== undefined && body.modelKey !== existing.model_file_key) {
          if (!isStorageConfigured()) throw serviceUnavailable('Object storage is not configured');
          const file = await lookupFile(body.modelKey);
          if (!file.exists) {
            throw badRequest('No uploaded file found for that key; complete the upload first');
          }
          changes.modelFileKey = body.modelKey;
          changes.fileSizeBytes = file.sizeBytes;
          changes.tourUrl = file.url;
          replacedKey = existing.model_file_key;
        }
      } else {
        if (body.modelKey !== undefined) throw fieldError('modelKey', 'Only a Three.js tour has a model file');
        if (existing.tour_type === 'custom_viewer' && body.embedCode !== undefined) {
          throw fieldError('embedCode', 'A custom viewer tour has no embed code');
        }

        // Mirrors virtual_tours_payload_present against the row as it will be
        // after the update, so clearing the last payload is a 422, not a 500.
        const tourUrl = body.tourUrl === undefined ? existing.tour_url : body.tourUrl;
        const embedCode = body.embedCode === undefined ? existing.embed_code : body.embedCode;
        if (existing.tour_type === 'custom_viewer' && !tourUrl) {
          throw fieldError('tourUrl', 'A tour URL is required');
        }
        if (existing.tour_type === 'matterport_embed' && !tourUrl && !embedCode) {
          throw fieldError('embedCode', 'An embed code or tour URL is required');
        }

        changes.tourUrl = body.tourUrl;
        changes.embedCode = body.embedCode;
      }

      const updated = await tours.update(existing.id, changes);
      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Tour not found');

      if (replacedKey) {
        // Same posture as DELETE: the tour already points at the new file, so a
        // failed delete of the old one is an orphan to clean up, not a failure.
        await deleteFile(replacedKey).catch((error: Error) => {
          logger.error('Failed to delete replaced tour asset from storage', {
            key: replacedKey,
            error: error.message,
          });
        });
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.TOUR_UPDATED,
        entityType: 'virtual_tour',
        entityId: existing.id,
        changes: {
          projectId: existing.project_id,
          fields: Object.keys(body),
          ...(changes.modelFileKey ? { previousKey: replacedKey, key: changes.modelFileKey } : {}),
        },
        ipAddress: ip,
      });

      return serializeTourForAdmin(updated);
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'tours:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await tours.remove(query.tourId);
      if (!removed) throw notFound('Tour not found');

      if (removed.model_file_key) {
        // The database row is already gone; a failed object delete leaves an
        // orphaned file, which is a cleanup problem rather than a request
        // failure worth surfacing to the operator.
        await deleteFile(removed.model_file_key).catch((error: Error) => {
          logger.error('Failed to delete tour asset from storage', {
            key: removed.model_file_key,
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
        changes: { projectId: removed.project_id, key: removed.model_file_key },
        ipAddress: ip,
      });

      return noContent();
    },
  },
});
