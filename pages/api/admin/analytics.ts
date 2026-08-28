import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import * as analytics from '@/lib/repositories/analytics';
import * as users from '@/lib/repositories/users';
import { query } from '@/lib/db';

/** GET /api/admin/analytics — dashboard metrics for the past 7/30/90 days (§3). */
export default createRoute({
  GET: {
    query: z.object({ period: z.enum(['7', '30', '90']).default('30') }),
    roles: ['admin', 'viewer'],
    permission: 'analytics:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query: q }) => {
      const periodDays = Number(q.period) as 7 | 30 | 90;

      const [summary, roleCounts, content] = await Promise.all([
        analytics.summary(periodDays),
        users.countByRole(),
        query<{ published_projects: string; published_news: string; tours: string }>(
          `SELECT
             (SELECT count(*)::text FROM projects
               WHERE deleted_at IS NULL AND published_at IS NOT NULL) AS published_projects,
             (SELECT count(*)::text FROM news_articles
               WHERE deleted_at IS NULL AND published_at IS NOT NULL) AS published_news,
             (SELECT count(*)::text FROM virtual_tours WHERE published = TRUE) AS tours`,
        ),
      ]);

      return {
        ...summary,
        usersByRole: roleCounts,
        content: {
          publishedProjects: Number(content.rows[0]?.published_projects ?? 0),
          publishedNews: Number(content.rows[0]?.published_news ?? 0),
          publishedTours: Number(content.rows[0]?.tours ?? 0),
        },
      };
    },
  },
});
