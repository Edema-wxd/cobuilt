import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { listApplicationsQuery } from '@/lib/schemas/careers';
import * as jobApplications from '@/lib/repositories/jobApplications';

/**
 * GET /api/admin/careers/applications — the applications inbox, newest first.
 *
 * Filters: `vacancy` (an id, or `speculative`), `status` and `flaggedAsSpam`.
 * Contact details are masked here, as in the form inbox (§2.8); opening one
 * application shows them and is audited. Needs `applications:read`, which only
 * admins hold by default: editors manage vacancies but do not read CVs.
 */
export default createRoute({
  GET: {
    query: listApplicationsQuery,
    permission: 'applications:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => jobApplications.list(query),
  },
});
