import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { env } from '@/lib/env';
import { inquiryBody } from '@/lib/schemas/forms';
import { checkSpam } from '@/lib/spam';
import * as forms from '@/lib/repositories/forms';
import { enqueueEmail } from '@/lib/queues';
import { header } from '@/lib/http/request';

/**
 * POST /api/forms/inquiry — public contact form (§8).
 *
 * Order of operations matters: validate, score for spam, store, then queue the
 * notification. The submission is durably stored before any email is queued,
 * so a mail outage can never lose an enquiry.
 */
export default createRoute({
  POST: {
    body: inquiryBody,
    rateLimit: RATE_LIMITS.inquiry,
    // Public endpoint, no session to protect; the honeypot and rate limit are
    // the abuse controls here.
    csrf: false,
    handler: async ({ body, ip, userAgent, req }) => {
      const spam = await checkSpam({
        name: body.name,
        email: body.email,
        content: body.message,
        ip,
        userAgent,
        referrer: header(req, 'referer'),
        honeypot: body.website,
      });

      const submission = await forms.create({
        formType: 'inquiry',
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        message: body.message,
        metadata: {
          subject: body.subject ?? null,
          projectId: body.projectId ?? null,
          consentGivenAt: new Date().toISOString(),
          spamReasons: spam.reasons,
        },
        ipAddress: ip,
        userAgent,
        spamScore: spam.score,
        flaggedAsSpam: spam.isSpam,
      });

      // Spam is stored for review but generates no notification, and the
      // response is identical to a clean submission so a bot learns nothing.
      if (spam.isSpam) {
        return created({ success: true, submissionId: submission.id });
      }

      await Promise.all([
        enqueueEmail({
          type: 'inquiry-notification',
          to: env.ADMIN_EMAIL,
          payload: {
            submissionId: submission.id,
            name: body.name,
            email: body.email,
            phone: body.phone ?? null,
            subject: body.subject ?? null,
            message: body.message,
          },
        }),
        enqueueEmail({
          type: 'inquiry-confirmation',
          to: body.email,
          payload: { name: body.name },
        }),
      ]);

      return created({ success: true, submissionId: submission.id });
    },
  },
});
