import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { dataSubjectBody } from '@/lib/schemas/privacy';
import * as dataSubjects from '@/lib/repositories/dataSubjects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { maskEmail, maskPhone } from '@/lib/privacy';

/**
 * POST /api/admin/data-subjects/export: subject access request for someone
 * without an account (NDPA). POST, not GET, so the email or phone number never
 * appears in a URL and therefore never in access logs.
 */
export default createRoute({
  POST: {
    body: dataSubjectBody,
    permission: 'privacy:manage',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      const [data, account] = await Promise.all([
        dataSubjects.exportData(body),
        dataSubjects.findAccount(body.email),
      ]);

      // The audit entry must not itself become a copy of the identifiers.
      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.DATA_SUBJECT_EXPORTED,
        entityType: 'data_subject',
        changes: {
          email: maskEmail(body.email),
          phone: maskPhone(body.phone),
          formSubmissions: data.formSubmissions.length,
          newsletter: data.newsletter.length,
          chatEvents: data.chatEvents.length,
          whatsappMessages: data.whatsappMessages.length,
        },
        ipAddress: ip,
      });

      const document = {
        exportedAt: new Date().toISOString(),
        identifiers: { email: body.email ?? null, phone: body.phone ?? null },
        // Account data is exported through /api/users/{userId}/export.
        account: account ? { id: account.id, role: account.role } : null,
        ...data,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="data-subject-export.json"');
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(JSON.stringify(document, null, 2));
    },
  },
});
