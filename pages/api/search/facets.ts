import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { query as sql } from '@/lib/db';
import * as projects from '@/lib/repositories/projects';

/**
 * GET /api/search/facets — the filter options a listing page should offer,
 * with counts, so the UI never renders a filter that returns nothing.
 */
export default createRoute({
  GET: {
    query: z.object({ type: z.enum(['project', 'news']).default('project') }),
    rateLimit: RATE_LIMITS.api,
    cache: { sMaxAge: 3600, staleWhileRevalidate: 1800 },
    handler: async ({ query }) =>
      remember(key('search:facets', query), TTL.facets, async () => {
        if (query.type === 'news') {
          const [categories, tags] = await Promise.all([
            sql<{ value: string; count: string }>(
              `SELECT category AS value, count(*)::text AS count
                 FROM news_articles
                WHERE deleted_at IS NULL AND published_at IS NOT NULL
                  AND published_at <= NOW() AND category IS NOT NULL
                GROUP BY category ORDER BY count(*) DESC`,
            ),
            sql<{ value: string; count: string }>(
              `SELECT tag AS value, count(*)::text AS count
                 FROM news_articles, unnest(tags) AS tag
                WHERE deleted_at IS NULL AND published_at IS NOT NULL
                  AND published_at <= NOW()
                GROUP BY tag ORDER BY count(*) DESC LIMIT 40`,
            ),
          ]);

          return {
            type: 'news',
            categories: categories.rows.map((r) => ({ value: r.value, count: Number(r.count) })),
            tags: tags.rows.map((r) => ({ value: r.value, count: Number(r.count) })),
          };
        }

        return { type: 'project', ...(await projects.facets()) };
      }),
  },
});
