import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, remember } from '@/lib/cache';
import * as vacancies from '@/lib/repositories/vacancies';

/**
 * GET /api/vacancies — the vacancies open for applications, in editorial
 * order: published, and not past their closing date (West Africa Time).
 *
 * Unpaginated: a company of CoBuilt's size advertises a handful at a time.
 * Drafts and closed vacancies are never returned. A vacancy closes at the end
 * of its closing day, so the cached list can show one for up to a minute
 * after midnight; the application route checks again and refuses it.
 */
export default createRoute({
  GET: {
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async () => ({
      results: await remember('vacancies:list', TTL.vacancies, () => vacancies.listOpen()),
    }),
  },
});
