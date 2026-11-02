import { createRoute, created } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { env } from '@/lib/env';
import { inquiryBody } from '@/lib/schemas/forms';
import { checkSpam } from '@/lib/spam';
import * as forms from '@/lib/repositories/forms';
import { enqueueEmail } from '@/lib/queues';
import { header } from '@/lib/http/request';
import { badRequest, serviceUnavailable, validationFailed } from '@/lib/http/errors';
import { isTurnstileEnabled, verifyTurnstile } from '@/lib/turnstile';
import { enquiryTypeLabel } from '@/lib/enquiryTypes';

/**
 * POST /api/forms/inquiry — public contact form (§8).
 *
 * Order of operations matters: validate, check the CAPTCHA, score for spam,
 * store, then queue the notification. The submission is durably stored before
 * any email is queued, so a mail outage can never lose an enquiry.
 *
 * The CAPTCHA is Cloudflare Turnstile, and is checked only while
 * `TURNSTILE_SECRET_KEY` is set (src/lib/turnstile.ts). Then it fails closed:
 * no token is a 422, a token Cloudflare refuses is a 400, and no answer from
 * Cloudflare is a 503 — the visitor can try again, or call. Nothing is stored
 * for a submission that fails it.
 *
 * `enquiryType` (general, partnership, media…) is stored with the submission
 * and leads the staff email, so enquiries can be routed without opening each.
 */
export default createRoute({
  POST: {
    body: inquiryBody,
    rateLimit: RATE_LIMITS.inquiry,
    // Public endpoint, no session to protect; the honeypot, the CAPTCHA and
    // the rate limit are the abuse controls here.
    csrf: false,
    handler: async ({ body, ip, userAgent, req }) => {
      if (isTurnstileEnabled()) {
        if (!body.turnstileToken) {
          throw validationFailed(
            [{ field: 'turnstileToken', message: 'Complete the check that you are not a robot, then send again' }],
            'Invalid request body',
          );
        }
        const check = await verifyTurnstile(body.turnstileToken, ip);
        if (!check.ok && check.reason === 'unavailable') {
          throw serviceUnavailable('The anti-spam check could not be completed. Try again shortly');
        }
        if (!check.ok) {
          throw badRequest('The anti-spam check failed. Try it again, then send', [
            { field: 'turnstileToken', message: 'The check was not accepted' },
          ]);
        }
      }

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
          enquiryType: body.enquiryType,
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
            enquiryType: enquiryTypeLabel(body.enquiryType),
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
