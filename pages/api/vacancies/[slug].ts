import { createRoute, CONTENT_CACHE } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { TTL, key, remember } from '@/lib/cache';
import { notFound } from '@/lib/http/errors';
import { vacancySlugQuery } from '@/lib/schemas/careers';
import * as vacancies from '@/lib/repositories/vacancies';

/**
 * GET /api/vacancies/[slug] — one vacancy open for applications.
 *
 * A draft, or a vacancy past its closing date, is a 404 here. (The page at
 * `/careers/[slug]` still shows a closed one, saying it has closed; the API
 * answers only for vacancies that can be applied to.)
 */
export default createRoute({
  GET: {
    query: vacancySlugQuery,
    rateLimit: RATE_LIMITS.api,
    cache: CONTENT_CACHE,
    handler: async ({ query }) => {
      const vacancy = await remember(key('vacancies:detail', { slug: query.slug }), TTL.vacancies, () =>
        vacancies.findPublishedBySlug(query.slug),
      );
      if (!vacancy || !vacancy.isOpen) throw notFound('Vacancy not found');
      return vacancy;
    },
  },
});
