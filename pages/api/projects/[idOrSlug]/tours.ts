import { z } from 'zod';
import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound } from '@/lib/http/errors';
import * as projects from '@/lib/repositories/projects';
import * as tours from '@/lib/repositories/tours';
import { serializeTour, serializeTourForAdmin } from '@/lib/serializers';

/** GET /api/projects/[idOrSlug]/tours — 3D tours for a project (§7). */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default createRoute({
  GET: {
    query: z.object({ idOrSlug: z.string().min(1).max(255) }),
    rateLimit: RATE_LIMITS.api,
    auth: 'optional',
    cache: CONTENT_CACHE,
    handler: async ({ query, auth }) => {
      const isStaff = auth?.role === 'admin' || auth?.role === 'editor';

      const project = UUID_PATTERN.test(query.idOrSlug)
        ? await projects.findById(query.idOrSlug, { includeUnpublished: isStaff })
        : await projects.findBySlug(query.idOrSlug, { includeUnpublished: isStaff });

      if (!project) throw notFound('Project not found');

      const rows = await tours.listForProject(project.id, { includeUnpublished: isStaff });

      return {
        projectId: project.id,
        results: rows
          // A tour whose asset is still processing would render as a broken
          // viewer, so it is withheld from the public list.
          .filter((tour) => isStaff || tour.processing_status === 'ready')
          // Staff see drafts too, so they also need to see which ones are drafts.
          .map(isStaff ? serializeTourForAdmin : serializeTour),
      };
    },
  },
});
