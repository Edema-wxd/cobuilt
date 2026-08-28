import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember, invalidatePrefix } from '@/lib/cache';
import { conflict } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { createNewsBody, listNewsQuery } from '@/lib/schemas/news';
import * as news from '@/lib/repositories/news';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeNews, serializeNewsSummary } from '@/lib/serializers';
import { enqueueSearch } from '@/lib/queues';

/**
 * /api/news
 *   GET  — public article list, newest first
 *   POST — editor/admin, create an article
 */
export default createRoute({
  GET: {
    query: listNewsQuery,
    rateLimit: RATE_LIMITS.api,
    auth: 'optional',
    cache: { sMaxAge: 3600, staleWhileRevalidate: 600 },
    handler: async ({ query, auth }) => {
      const canSeeDrafts =
        query.includeUnpublished && (auth?.role === 'admin' || auth?.role === 'editor');

      const load = () =>
        news.list({
          category: query.category,
          tag: query.tag,
          q: query.q,
          page: query.page,
          pageSize: query.pageSize,
          includeUnpublished: canSeeDrafts,
        });

      const page = canSeeDrafts
        ? await load()
        : await remember(key('news:list', { ...query, includeUnpublished: false }), TTL.news, load);

      return { ...page, results: page.results.map(serializeNewsSummary) };
    },
  },

  POST: {
    body: createNewsBody,
    roles: ['admin', 'editor'],
    permission: 'news:write',
    handler: async ({ body, auth, ip }) => {
      let article;
      try {
        article = await news.create(body, auth!.userId);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('An article with that slug already exists');
        }
        throw error;
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.NEWS_CREATED,
        entityType: 'news_article',
        entityId: article.id,
        changes: { title: article.title, slug: article.slug },
        ipAddress: ip,
      });

      await Promise.all([
        invalidatePrefix('news'),
        enqueueSearch({ action: 'upsert', index: 'news', id: article.id }),
      ]);

      return created(serializeNews(article));
    },
  },
});
