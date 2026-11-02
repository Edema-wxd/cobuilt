import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { listVideosQuery } from '@/lib/schemas/videos';
import * as videos from '@/lib/repositories/videos';

/**
 * GET /api/videos — published videos in display order, a page at a time.
 *
 * `category` narrows to one of the library's categories, `project` to one live
 * project's films (by slug), and `q` matches words in the title, the
 * description or the project's name. Drafts are managed through
 * `/api/admin/videos` and never appear here, whoever is asking.
 */
export default createRoute({
  GET: {
    query: listVideosQuery,
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) =>
      remember(key('videos:list', query), TTL.videos, () => videos.listPublished(query)),
  },
});
