import { z } from 'zod';
import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { pagination } from '@/lib/schemas/common';
import * as news from '@/lib/repositories/news';
import { serializeNewsSummary } from '@/lib/serializers';

/** GET /api/news/by-category/[category] — articles filtered by category. */
export default createRoute({
  GET: {
    query: pagination.extend({ category: z.string().min(1).max(100) }),
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const page = await remember(
        key('news:category', query),
        TTL.news,
        () =>
          news.list({
            category: query.category,
            page: query.page,
            pageSize: query.pageSize,
          }),
      );

      return {
        category: query.category,
        ...page,
        results: page.results.map(serializeNewsSummary),
      };
    },
  },
});
