import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound, serviceUnavailable } from '@/lib/http/errors';
import { isStorageConfigured, presignTourUpload } from '@/lib/storage/s3';
import * as projects from '@/lib/repositories/projects';

/**
 * POST /api/admin/tours/presign — issues a direct-to-storage upload URL (§7).
 *
 * The browser PUTs the model straight to object storage with this URL, then
 * calls POST /api/admin/tours to register it. Proxying a 50 MB upload through
 * an API route would tie up a worker for the whole transfer and exceed the
 * default body limit.
 */
export default createRoute({
  POST: {
    body: z.object({
      projectId: z.string().uuid(),
      contentType: z.string().min(3).max(100),
      contentLength: z.number().int().positive(),
    }),
    roles: ['admin', 'editor'],
    permission: 'tours:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body }) => {
      if (!isStorageConfigured()) {
        throw serviceUnavailable('Object storage is not configured');
      }

      if (!(await projects.exists(body.projectId))) throw notFound('Project not found');

      return presignTourUpload({
        projectId: body.projectId,
        contentType: body.contentType,
        contentLength: body.contentLength,
      });
    },
  },
});
