import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { revalidatePages } from '@/lib/http/revalidate';
import { createVacancyBody } from '@/lib/schemas/careers';
import * as vacancies from '@/lib/repositories/vacancies';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/careers/vacancies
 *   GET  — every vacancy, drafts and closed ones included, in display order,
 *          with how many applications each holds (counts only: reading the
 *          applications themselves needs `applications:read`)
 *   POST — add a vacancy, at the end of the list and unpublished by default
 */
export default createRoute({
  GET: {
    roles: ['admin', 'editor'],
    permission: 'careers:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => ({ results: await vacancies.listAll() }),
  },

  POST: {
    body: createVacancyBody,
    roles: ['admin', 'editor'],
    permission: 'careers:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      const vacancy = await vacancies.create({ ...body, createdBy: auth!.userId });

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VACANCY_CREATED,
        entityType: 'vacancy',
        entityId: vacancy.id,
        changes: {
          title: vacancy.title,
          type: vacancy.type,
          closingDate: vacancy.closingDate,
          published: vacancy.published,
        },
        ipAddress: ip,
      });

      await invalidatePrefix('vacancies');
      if (vacancy.published) await revalidatePages(res, ['/careers', `/careers/${vacancy.slug}`]);

      return created(vacancy);
    },
  },
});
