import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { validationFailed } from '@/lib/http/errors';
import { revalidatePages } from '@/lib/http/revalidate';
import { reorderVacanciesBody } from '@/lib/schemas/careers';
import * as vacancies from '@/lib/repositories/vacancies';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * POST /api/admin/careers/vacancies/reorder — sets the display order of every
 * vacancy.
 *
 * The body is the whole list in its new order, so a move is one request and
 * the result does not depend on what else was moved. `/careers` groups by
 * type and keeps this order within each group. A list that leaves out a
 * vacancy, or names one that does not exist, is a 422: the screen it came from
 * is out of date.
 */
export default createRoute({
  POST: {
    body: reorderVacanciesBody,
    roles: ['admin', 'editor'],
    permission: 'careers:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      if (!(await vacancies.reorder(body.ids))) {
        throw validationFailed(
          [{ field: 'ids', message: 'Must list every vacancy exactly once; reload and try again' }],
          'Invalid request body',
        );
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VACANCIES_REORDERED,
        entityType: 'vacancy',
        changes: { order: body.ids },
        ipAddress: ip,
      });

      await invalidatePrefix('vacancies');
      await revalidatePages(res, ['/careers']);

      return { results: await vacancies.listAll() };
    },
  },
});
