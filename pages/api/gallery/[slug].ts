import { z } from 'zod';
import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import * as gallery from '@/lib/repositories/gallery';

/**
 * GET /api/gallery/[slug] — a published album with its images, in order, each
 * with its alt text and caption.
 *
 * Published only; a draft, or an album with no images yet, is a 404 here as
 * on the page.
 */
export default createRoute({
  GET: {
    query: z.object({ slug: z.string().min(1).max(255) }),
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const album = await remember(key('gallery:album', { slug: query.slug }), TTL.gallery, () =>
        gallery.findPublishedBySlug(query.slug),
      );

      if (!album) throw notFound('Album not found');
      return album;
    },
  },
});
