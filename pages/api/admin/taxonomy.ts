import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import * as projects from '@/lib/repositories/projects';

/**
 * GET /api/admin/taxonomy — every project type, location, sector, service and
 * tag with its id, for the project editor's pickers.
 *
 * /api/search/facets lists only values in use on live projects, keyed by
 * slug; an editor needs the full set, keyed by the id the write API takes.
 */
export default createRoute({
  GET: {
    roles: ['admin', 'editor'],
    permission: 'projects:write',
    rateLimit: RATE_LIMITS.api,
    handler: () => projects.taxonomyOptions(),
  },
});
