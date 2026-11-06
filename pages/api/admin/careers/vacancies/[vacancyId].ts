import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict, notFound } from '@/lib/http/errors';
import { isPgError, PG_ERROR } from '@/lib/db';
import { revalidatePages } from '@/lib/http/revalidate';
import { updateVacancyBody } from '@/lib/schemas/careers';
import * as vacancies from '@/lib/repositories/vacancies';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/careers/vacancies/[vacancyId]
 *   GET    — one vacancy, drafts included
 *   PATCH  — update, publish, unpublish, change the closing date
 *   DELETE — admin only, and only while it holds no applications
 *
 * Unpublishing, or a closing date in the past, is the everyday way to take a
 * vacancy down. Deleting is for one created by mistake: a vacancy that has
 * applications cannot be deleted (409), because they would lose the role they
 * were sent for. Once its applications are deleted — by hand or by the
 * retention purge — it can be.
 */

const params = z.object({ vacancyId: z.string().uuid() });

/** The public pages a vacancy appears on. */
const pagesFor = (slug: string) => ['/careers', `/careers/${slug}`];

export default createRoute({
  GET: {
    query: params,
    roles: ['admin', 'editor'],
    permission: 'careers:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const vacancy = await vacancies.findById(query.vacancyId);
      if (!vacancy) throw notFound('Vacancy not found');
      return vacancy;
    },
  },

  PATCH: {
    query: params,
    body: updateVacancyBody,
    roles: ['admin', 'editor'],
    permission: 'careers:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip, res }) => {
      const existing = await vacancies.findById(query.vacancyId);
      if (!existing) throw notFound('Vacancy not found');

      let updated;
      try {
        updated = await vacancies.update(existing.id, body);
      } catch (error) {
        if (isPgError(error, PG_ERROR.UNIQUE_VIOLATION)) {
          throw conflict('Another vacancy already has that web address');
        }
        throw error;
      }
      // Null here means the row was deleted between the read and the write.
      if (!updated) throw notFound('Vacancy not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VACANCY_UPDATED,
        entityType: 'vacancy',
        entityId: existing.id,
        changes: {
          fields: Object.keys(body),
          // Publication and the closing date are what open or close the
          // vacancy to applicants, so the trail says which way they went.
          ...(body.published !== undefined && body.published !== existing.published
            ? { published: body.published }
            : {}),
          ...(body.closingDate !== undefined && body.closingDate !== existing.closingDate
            ? { closingDate: body.closingDate }
            : {}),
        },
        ipAddress: ip,
      });

      await invalidatePrefix('vacancies');
      if (existing.published || updated.published) {
        await revalidatePages(res, [...new Set([...pagesFor(existing.slug), ...pagesFor(updated.slug)])]);
      }

      return updated;
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'careers:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip, res }) => {
      let removed;
      try {
        removed = await vacancies.remove(query.vacancyId);
      } catch (error) {
        // An application arrived between the count and the delete.
        if (isPgError(error, PG_ERROR.FOREIGN_KEY_VIOLATION)) removed = 'has-applications' as const;
        else throw error;
      }
      if (removed === 'has-applications') {
        throw conflict('This vacancy has applications. Unpublish it instead, or delete its applications first');
      }
      if (!removed) throw notFound('Vacancy not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.VACANCY_DELETED,
        entityType: 'vacancy',
        entityId: removed.id,
        changes: { title: removed.title },
        ipAddress: ip,
      });

      await invalidatePrefix('vacancies');
      await revalidatePages(res, pagesFor(removed.slug));

      return noContent();
    },
  },
});
