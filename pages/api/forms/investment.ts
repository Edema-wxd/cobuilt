import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { env } from '@/lib/env';
import { investmentBody } from '@/lib/schemas/forms';
import { checkSpam } from '@/lib/spam';
import * as forms from '@/lib/repositories/forms';
import { enqueueEmail } from '@/lib/queues';
import { header } from '@/lib/http/request';

/**
 * POST /api/forms/investment — investor enquiry (§8, §10).
 *
 * Phase 1 is informational only: this endpoint records an expression of
 * interest and routes it to legal for review. It creates no investor account,
 * makes no offer and returns nothing that could be read as one.
 */
export default createRoute({
  POST: {
    body: investmentBody,
    rateLimit: RATE_LIMITS.investment,
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
        formType: 'investment',
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        message: body.message,
        metadata: {
          companyName: body.companyName ?? null,
          investmentRange: body.investmentRange ?? null,
          projectId: body.projectId ?? null,
          consentGivenAt: new Date().toISOString(),
          // Every investor enquiry is held for legal review before anyone
          // responds; the flag makes that state explicit in the record.
          requiresLegalReview: true,
          spamReasons: spam.reasons,
        },
        ipAddress: ip,
        userAgent,
        spamScore: spam.score,
        flaggedAsSpam: spam.isSpam,
      });

      if (!spam.isSpam) {
        await enqueueEmail({
          type: 'investment-notification',
          to: env.LEGAL_EMAIL,
          payload: {
            submissionId: submission.id,
            name: body.name,
            email: body.email,
            companyName: body.companyName ?? null,
            investmentRange: body.investmentRange ?? null,
            message: body.message,
          },
        });
      }

      return created({
        success: true,
        submissionId: submission.id,
        message:
          'Your enquiry has been received and will be reviewed by our team. ' +
          'This is not an offer to sell securities.',
      });
    },
  },
});
