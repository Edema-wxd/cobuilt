import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { newsletterConfirmQuery } from '@/lib/schemas/forms';
import * as newsletter from '@/lib/repositories/newsletter';
import { enqueueEmail } from '@/lib/queues';
import { badRequest } from '@/lib/http/errors';

/**
 * GET /api/forms/newsletter/confirm?token=... — completes double opt-in.
 *
 * GET rather than POST because it is reached by clicking a link in an email.
 * The token is single-use and consumed on first confirmation.
 */
export default createRoute({
  GET: {
    query: newsletterConfirmQuery,
    rateLimit: RATE_LIMITS.newsletter,
    handler: async ({ query }) => {
      const subscriber = await newsletter.confirm(query.token);
      if (!subscriber) throw badRequest('This confirmation link is invalid or has already been used');

      await enqueueEmail({
        type: 'newsletter-welcome',
        to: subscriber.email,
        payload: { unsubscribeToken: subscriber.unsubscribe_token },
      });

      return { success: true, message: 'Your subscription is confirmed.' };
    },
  },
});
