import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import * as services from '@/lib/repositories/services';

/**
 * GET /api/services — every published service, in editorial order.
 *
 * Unpaginated: the set is a handful of disciplines. Drafts are managed through
 * `/api/admin/services` and never appear here, whoever is asking.
 */
export default createRoute({
  GET: {
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async () => {
      const results = await remember(key('services:list'), TTL.services, () =>
        services.listPublished(),
      );
      return { results };
    },
  },
});
