import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { dataSubjectBody } from '@/lib/schemas/privacy';
import * as dataSubjects from '@/lib/repositories/dataSubjects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { maskEmail, maskPhone } from '@/lib/privacy';

/**
 * POST /api/admin/data-subjects/erase: erasure request for someone without an
 * account (NDPA). Form submissions are anonymised; newsletter, chat and
 * WhatsApp records are deleted. A staff account under the same email is left
 * alone and reported, because closing it is DELETE /api/users/{userId}.
 */
export default createRoute({
  POST: {
    body: dataSubjectBody,
    permission: 'privacy:manage',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      const [counts, account] = await Promise.all([
        dataSubjects.erase(body),
        dataSubjects.findAccount(body.email),
      ]);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.DATA_SUBJECT_ERASED,
        entityType: 'data_subject',
        changes: { email: maskEmail(body.email), phone: maskPhone(body.phone), ...counts },
        ipAddress: ip,
      });

      return {
        success: true,
        ...counts,
        accountId: account?.id ?? null,
      };
    },
  },
});
