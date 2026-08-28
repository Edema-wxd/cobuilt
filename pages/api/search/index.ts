import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { siteSearch } from '@/lib/search';

/**
 * GET /api/search — site-wide search across projects, news and FAQs (§6).
 */
export default createRoute({
  GET: {
    query: z.object({
      q: z.string().trim().min(1, 'A search term is required').max(200),
      type: z.enum(['project', 'news', 'faq']).optional(),
      status: z.string().max(50).optional(),
      sector: z.string().max(100).optional(),
      location: z.string().max(255).optional(),
      category: z.string().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(12),
    }),
    rateLimit: RATE_LIMITS.search,
    cache: { sMaxAge: 300, staleWhileRevalidate: 60 },
    handler: async ({ query }) =>
      remember(key('search', query), TTL.search, () =>
        siteSearch({
          q: query.q,
          type: query.type,
          page: query.page,
          pageSize: query.pageSize,
          filters: {
            status: query.status,
            sector: query.sector,
            location: query.location,
            category: query.category,
          },
        }),
      ),
  },
});
