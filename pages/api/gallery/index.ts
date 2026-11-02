import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { listGalleryQuery } from '@/lib/schemas/gallery';
import * as gallery from '@/lib/repositories/gallery';

/**
 * GET /api/gallery — published photo albums, in editorial order.
 *
 * Filters: `category` (one of the six) and `project` (a project's slug or id).
 * `facets` lists the categories and projects that have albums behind them, so
 * a client only offers filters that return something. Drafts, and albums with
 * no images yet, are managed through `/api/admin/gallery` and never appear
 * here, whoever is asking.
 */
export default createRoute({
  GET: {
    query: listGalleryQuery,
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const [page, facets] = await Promise.all([
        remember(key('gallery:list', query), TTL.gallery, () => gallery.listPublished(query)),
        remember(key('gallery:facets'), TTL.gallery, () => gallery.publishedFacets()),
      ]);
      return { ...page, facets };
    },
  },
});
