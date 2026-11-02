import { z } from 'zod';
import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { pagination } from '@/lib/schemas/common';
import { normalizeNewsCategory } from '@/lib/news-categories';
import * as news from '@/lib/repositories/news';
import { serializeNewsSummary } from '@/lib/serializers';

/**
 * GET /api/news/by-category/[category] — articles filtered by category. A
 * launch-era name (`update`, `announcement`) answers as the category it became.
 */
export default createRoute({
  GET: {
    query: pagination.extend({
      category: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .transform((value) => normalizeNewsCategory(value) ?? value),
    }),
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
