import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { listSubmissionsQuery } from '@/lib/schemas/forms';
import * as forms from '@/lib/repositories/forms';
import { serializeSubmissionSummary } from '@/lib/serializers';

/**
 * GET /api/admin/forms — form submissions for review (§3).
 *
 * Contact details are masked in the list; the detail endpoint reveals them.
 */
export default createRoute({
  GET: {
    query: listSubmissionsQuery,
    roles: ['admin', 'editor', 'viewer'],
    permission: 'forms:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const page = await forms.list(query);
      return { ...page, results: page.results.map(serializeSubmissionSummary) };
    },
  },
});
