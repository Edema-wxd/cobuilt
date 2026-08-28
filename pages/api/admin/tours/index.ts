import { z } from 'zod';
import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { badRequest, notFound } from '@/lib/http/errors';
import { headObject, publicUrlFor } from '@/lib/storage/s3';
import * as projects from '@/lib/repositories/projects';
import * as tours from '@/lib/repositories/tours';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeTour } from '@/lib/serializers';
import { httpUrl } from '@/lib/schemas/common';

/**
 * POST /api/admin/tours — registers a tour after its asset is uploaded (§7).
 *
 * A Three.js tour is only accepted once the object is confirmed present in
 * storage, so a presigned URL that was issued but never used cannot leave a
 * tour record pointing at nothing.
 */
const body = z
  .object({
    projectId: z.string().uuid(),
    tourName: z.string().trim().min(2).max(255),
    tourType: z.enum(['threejs_model', 'matterport_embed', 'custom_viewer']),
    modelKey: z.string().max(512).optional(),
    tourUrl: httpUrl.optional(),
    embedCode: z.string().max(10_000).optional(),
    thumbnailUrl: httpUrl.optional(),
    description: z.string().max(5000).optional(),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    // Mirrors the virtual_tours_payload_present CHECK constraint so the caller
    // gets a field-level 422 rather than a database error.
    if (value.tourType === 'threejs_model' && !value.modelKey) {
      ctx.addIssue({ code: 'custom', path: ['modelKey'], message: 'A model key is required for a Three.js tour' });
    }
    if (value.tourType === 'matterport_embed' && !value.embedCode && !value.tourUrl) {
      ctx.addIssue({ code: 'custom', path: ['embedCode'], message: 'An embed code or tour URL is required' });
    }
    if (value.tourType === 'custom_viewer' && !value.tourUrl) {
      ctx.addIssue({ code: 'custom', path: ['tourUrl'], message: 'A tour URL is required' });
    }
  });

export default createRoute({
  POST: {
    body,
    roles: ['admin', 'editor'],
    permission: 'tours:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body: input, auth, ip }) => {
      if (!(await projects.exists(input.projectId))) throw notFound('Project not found');

      let fileSizeBytes: number | null = null;
      let tourUrl = input.tourUrl ?? null;

      if (input.tourType === 'threejs_model') {
        const object = await headObject(input.modelKey);
        if (!object.exists) {
          throw badRequest('No uploaded object found for that key; complete the upload first');
        }
        fileSizeBytes = object.sizeBytes;
        tourUrl ??= publicUrlFor(input.modelKey);
      }

      const tour = await tours.create({
        projectId: input.projectId,
        tourName: input.tourName,
        tourType: input.tourType,
        modelFileS3Key: input.modelKey ?? null,
        fileSizeBytes,
        thumbnailUrl: input.thumbnailUrl ?? null,
        tourUrl,
        embedCode: input.embedCode ?? null,
        description: input.description ?? null,
        featured: input.featured,
        published: input.published,
        // A verified upload or a third-party embed is immediately viewable;
        // nothing in Phase 1 needs a server-side processing step.
        processingStatus: 'ready',
        createdBy: auth!.userId,
      });

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.TOUR_CREATED,
        entityType: 'virtual_tour',
        entityId: tour.id,
        changes: { projectId: input.projectId, tourType: input.tourType },
        ipAddress: ip,
      });

      return created(serializeTour(tour));
    },
  },
});
