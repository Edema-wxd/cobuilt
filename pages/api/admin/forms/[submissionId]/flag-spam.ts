import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound } from '@/lib/http/errors';
import * as forms from '@/lib/repositories/forms';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeSubmissionSummary } from '@/lib/serializers';

/** POST /api/admin/forms/[submissionId]/flag-spam — mark or unmark as spam (§3). */
export default createRoute({
  POST: {
    query: z.object({ submissionId: z.string().uuid() }),
    body: z.object({ flagged: z.boolean().default(true) }),
    roles: ['admin', 'editor'],
    permission: 'forms:moderate',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, body, auth, ip }) => {
      const updated = await forms.setSpamFlag(query.submissionId, body.flagged, auth!.userId);
      if (!updated) throw notFound('Submission not found');

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.FORM_SPAM_FLAGGED,
        entityType: 'form_submission',
        entityId: query.submissionId,
        changes: { flagged: body.flagged },
        ipAddress: ip,
      });

      return serializeSubmissionSummary(updated);
    },
  },
});
