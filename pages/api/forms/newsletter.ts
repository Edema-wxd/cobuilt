import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { newsletterBody } from '@/lib/schemas/forms';
import { heuristicScore } from '@/lib/spam';
import * as newsletter from '@/lib/repositories/newsletter';
import { enqueueEmail } from '@/lib/queues';

/**
 * POST /api/forms/newsletter — double opt-in subscription (§8).
 *
 * The response is identical whether the address is new or already subscribed,
 * so the endpoint cannot be used to test whether someone is on the list.
 */
export default createRoute({
  POST: {
    body: newsletterBody,
    rateLimit: RATE_LIMITS.newsletter,
    csrf: false,
    handler: async ({ body, ip, userAgent }) => {
      const spam = heuristicScore({
        email: body.email,
        content: body.fullName ?? '',
        userAgent,
        honeypot: body.website,
      });

      if (spam.isSpam) {
        return { success: true, message: 'Check your inbox to confirm your subscription.' };
      }

      const outcome = await newsletter.subscribe({
        email: body.email,
        fullName: body.fullName ?? null,
        source: body.source ?? null,
        ipAddress: ip,
      });

      if (outcome.status === 'pending_confirmation') {
        await enqueueEmail({
          type: 'newsletter-confirmation',
          to: body.email,
          payload: { token: outcome.confirmationToken },
        });
      }

      return { success: true, message: 'Check your inbox to confirm your subscription.' };
    },
  },
});
