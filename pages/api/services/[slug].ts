import { z } from 'zod';
import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import * as services from '@/lib/repositories/services';

/**
 * GET /api/services/[slug] — a published service with the live projects an
 * editor attached to it: case studies, then the other related projects.
 *
 * Published only; an unpublished service is a 404 here as on the page.
 */
export default createRoute({
  GET: {
    query: z.object({ slug: z.string().min(1).max(255) }),
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const data = await remember(key('services:detail', { slug: query.slug }), TTL.services, async () => {
        const service = await services.findPublishedBySlug(query.slug);
        if (!service) return null;
        return { ...service, ...(await services.publishedProjectsFor(service.id)) };
      });

      if (!data) throw notFound('Service not found');
      return data;
    },
  },
});
