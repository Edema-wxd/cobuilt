import { createRoute } from '@/lib/http/route';
import { checkDatabase } from '@/lib/db';
import { checkRedis } from '@/lib/redis';
import { checkSearch, isSearchConfigured } from '@/lib/search';
import { checkCms, isCmsConfigured } from '@/lib/cms/strapi';
import { ApiResponse } from '@/lib/http/route';

/**
 * GET /api/health — liveness and dependency check for the load balancer (§13).
 *
 * PostgreSQL is the only hard dependency: without it no request can be served.
 * Redis, search and the CMS are reported but degraded rather than fatal,
 * because the site stays usable without them.
 */
export default createRoute({
  GET: {
    handler: async () => {
      const [database, redis, search, cms] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        isSearchConfigured() ? checkSearch() : Promise.resolve(null),
        isCmsConfigured() ? checkCms() : Promise.resolve(null),
      ]);

      const degraded = [
        !redis && 'redis',
        search === false && 'search',
        cms === false && 'cms',
      ].filter(Boolean) as string[];

      const status = !database ? 'unhealthy' : degraded.length > 0 ? 'degraded' : 'healthy';

      return new ApiResponse(
        database ? 200 : 503,
        {
          status,
          checks: {
            database,
            redis,
            search: search ?? 'not_configured',
            cms: cms ?? 'not_configured',
          },
          degraded,
          version: process.env.npm_package_version ?? 'unknown',
          timestamp: new Date().toISOString(),
        },
        { 'Cache-Control': 'no-store' },
      );
    },
  },
});
