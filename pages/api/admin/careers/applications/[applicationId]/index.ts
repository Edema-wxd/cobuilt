import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound } from '@/lib/http/errors';
import { maskEmail, maskPhone } from '@/lib/privacy';
import { updateApplicationBody } from '@/lib/schemas/careers';
import * as jobApplications from '@/lib/repositories/jobApplications';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/careers/applications/[applicationId]
 *   GET    — one application, contact details and cover note in full; each
 *            opening is audited against the reader, as for a form submission
 *   PATCH  — status, staff notes, or the spam flag
 *   DELETE — admin only; deletes the CV with it
 *
 * Every route here needs `applications:read`. The audit entries name the
 * application by id and say what changed — never the notes' text, the CV or
 * the applicant's contact details beyond a masked form (as the data-subject
 * routes do), so the audit log does not become a second copy of them.
 */

const params = z.object({ applicationId: z.string().uuid() });

export default createRoute({
  GET: {
    query: params,
    permission: 'applications:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const application = await jobApplications.findById(query.applicationId);
      if (!application) throw notFound('Application not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.JOB_APPLICATION_VIEWED,
        entityType: 'job_application',
        entityId: application.id,
        changes: { vacancyId: application.vacancy?.id ?? null },
        ipAddress: ip,
      });

      return application;
    },
  },

  PATCH: {
    query: params,
    body: updateApplicationBody,
    permission: 'applications:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const existing = await jobApplications.findById(query.applicationId);
      if (!existing) throw notFound('Application not found');

      const updated = await jobApplications.update(existing.id, body);
      if (!updated) throw notFound('Application not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.JOB_APPLICATION_UPDATED,
        entityType: 'job_application',
        entityId: existing.id,
        changes: {
          fields: Object.keys(body),
          ...(body.status !== undefined && body.status !== existing.status
            ? { status: { from: existing.status, to: body.status } }
            : {}),
          ...(body.flaggedAsSpam !== undefined ? { flaggedAsSpam: body.flaggedAsSpam } : {}),
          // Notes may name the applicant or judge them; that they changed is enough.
          ...(body.staffNotes !== undefined ? { staffNotesChanged: body.staffNotes !== existing.staffNotes } : {}),
        },
        ipAddress: ip,
      });

      return updated;
    },
  },

  DELETE: {
    query: params,
    roles: ['admin'],
    permission: 'applications:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const removed = await jobApplications.remove(query.applicationId);
      if (!removed) throw notFound('Application not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.JOB_APPLICATION_DELETED,
        entityType: 'job_application',
        entityId: removed.id,
        changes: {
          vacancyId: removed.vacancyId,
          email: maskEmail(removed.email),
          phone: maskPhone(removed.phone),
        },
        ipAddress: ip,
      });

      return noContent();
    },
  },
});
