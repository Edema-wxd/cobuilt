import { z } from 'zod';
import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import * as videos from '@/lib/repositories/videos';

/**
 * GET /api/videos/[slug] — a published video with the films to watch next:
 * the same project's first, then the same category's.
 *
 * Published only; a draft is a 404 here as on the page.
 */
export default createRoute({
  GET: {
    query: z.object({ slug: z.string().min(1).max(255) }),
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const data = await remember(key('videos:detail', { slug: query.slug }), TTL.videos, async () => {
        const video = await videos.findPublishedBySlug(query.slug);
        if (!video) return null;
        return { ...video, related: await videos.relatedTo(video) };
      });

      if (!data) throw notFound('Video not found');
      return data;
    },
  },
});
