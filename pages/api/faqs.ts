import { z } from 'zod';
import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import * as faqs from '@/lib/repositories/faqs';

/**
 * GET /api/faqs — every published FAQ, in editorial order.
 *
 * Unpaginated: the set is a few dozen entries at most, and the page groups
 * them by category client-side.
 */
export default createRoute({
  GET: {
    query: z.object({ category: z.string().trim().max(100).optional() }),
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const results = await remember(key('faqs:list', query), TTL.news, () =>
        faqs.listPublished(query.category),
      );
      return { results };
    },
  },
});
