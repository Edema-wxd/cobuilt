import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember, invalidatePrefix } from '@/lib/cache';
import { notFound, conflict } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { updateNewsBody } from '@/lib/schemas/news';
import * as news from '@/lib/repositories/news';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeNews, serializeNewsSummary } from '@/lib/serializers';
import { enqueueSearch } from '@/lib/queues';

/**
 * /api/news/[idOrSlug]
 *   GET    — article detail plus related articles
 *   PUT    — editor/admin update
 *   DELETE — admin soft delete
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const params = z.object({ idOrSlug: z.string().min(1).max(255) });

async function resolve(idOrSlug: string, includeUnpublished: boolean) {
  return UUID_PATTERN.test(idOrSlug)
    ? news.findById(idOrSlug, { includeUnpublished })
    : news.findBySlug(idOrSlug, { includeUnpublished });
}

export default createRoute({
  GET: {
    query: params.extend({ includeUnpublished: z.coerce.boolean().default(false) }),
    rateLimit: RATE_LIMITS.api,
    auth: 'optional',
    cache: { sMaxAge: 3600, staleWhileRevalidate: 600 },
    handler: async ({ query, auth }) => {
      const canSeeDrafts =
        query.includeUnpublished && (auth?.role === 'admin' || auth?.role === 'editor');

      const load = async () => {
        const article = await resolve(query.idOrSlug, canSeeDrafts);
        if (!article) return null;
        return { article, related: await news.related(article.id) };
      };

      const data = canSeeDrafts
        ? await load()
        : await remember(key('news:detail', { idOrSlug: query.idOrSlug }), TTL.news, load);

      if (!data) throw notFound('Article not found');

      return {
        ...serializeNews(data.article),
        related: data.related.map(serializeNewsSummary),
      };
    },
  },

  PUT: {
    query: params,
    body: updateNewsBody,
    roles: ['admin', 'editor'],
    permission: 'news:write',
    handler: async ({ query, body, auth, ip }) => {
      const existing = await resolve(query.idOrSlug, true);
      if (!existing) throw notFound('Article not found');

      let updated;
      try {
        updated = await news.update(existing.id, body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('An article with that slug already exists');
        }
        throw error;
      }

      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Article not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.NEWS_UPDATED,
        entityType: 'news_article',
        entityId: existing.id,
        changes: { fields: Object.keys(body) },
        ipAddress: ip,
      });

      await Promise.all([
        invalidatePrefix('news'),
        enqueueSearch({ action: 'upsert', index: 'news', id: existing.id }),
      ]);

      return serializeNews(updated);
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'news:delete',
    handler: async ({ query, auth, ip }) => {
      const existing = await resolve(query.idOrSlug, true);
      if (!existing) throw notFound('Article not found');

      await news.softDelete(existing.id);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.NEWS_DELETED,
        entityType: 'news_article',
        entityId: existing.id,
        changes: { title: existing.title, slug: existing.slug },
        ipAddress: ip,
      });

      await Promise.all([
        invalidatePrefix('news'),
        enqueueSearch({ action: 'delete', index: 'news', id: existing.id }),
      ]);

      return noContent();
    },
  },
});
