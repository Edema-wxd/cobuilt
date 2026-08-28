import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { autocomplete } from '@/lib/search';

/**
 * GET /api/search/autocomplete — suggestions for the search box.
 *
 * Fires on nearly every keystroke, so it caches aggressively and returns a
 * deliberately small payload.
 */
export default createRoute({
  GET: {
    query: z.object({
      q: z.string().trim().min(2, 'Type at least two characters').max(100),
      limit: z.coerce.number().int().min(1).max(20).default(8),
    }),
    rateLimit: RATE_LIMITS.search,
    cache: { sMaxAge: 300, staleWhileRevalidate: 600 },
    handler: async ({ query }) => {
      const suggestions = await remember(
        key('search:autocomplete', query),
        TTL.search,
        () => autocomplete(query.q, query.limit),
      );

      return {
        query: query.q,
        results: suggestions.map((hit) => ({
          id: hit.id,
          type: hit.type,
          title: hit.title,
          url: hit.url,
        })),
      };
    },
  },
});
