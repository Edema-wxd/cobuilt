import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { listLeadershipQuery } from '@/lib/schemas/leadership';
import * as leadership from '@/lib/repositories/leadership';
import { serializeLeader } from '@/lib/serializers';

/**
 * GET /api/leadership — every published leader, in editorial order.
 *
 * `?featured=true` narrows it to the homepage spotlight. Unpaginated: the
 * leadership team is a handful of people. Drafts are never returned here; the
 * console reads them from /api/admin/leadership.
 */
export default createRoute({
  GET: {
    query: listLeadershipQuery,
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const results = await remember(
        key('leadership:list', { featured: query.featured || undefined }),
        TTL.leadership,
        async () =>
          (await leadership.listPublishedLeadership({ featured: query.featured })).map(
            serializeLeader,
          ),
      );
      return { results };
    },
  },
});
