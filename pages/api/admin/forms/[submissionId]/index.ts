import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound } from '@/lib/http/errors';
import * as forms from '@/lib/repositories/forms';
import * as audit from '@/lib/repositories/audit';
import { serializeSubmission } from '@/lib/serializers';

/**
 * GET /api/admin/forms/[submissionId] — full submission, contact details included.
 *
 * Reading personal data is itself auditable under NDPA (§11), so each view is
 * recorded against the reader.
 */
export default createRoute({
  GET: {
    query: z.object({ submissionId: z.string().uuid() }),
    roles: ['admin', 'editor'],
    permission: 'forms:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      const submission = await forms.findById(query.submissionId);
      if (!submission) throw notFound('Submission not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: 'form.viewed',
        entityType: 'form_submission',
        entityId: submission.id,
        changes: { formType: submission.form_type },
        ipAddress: ip,
      });

      return serializeSubmission(submission);
    },
  },
});
