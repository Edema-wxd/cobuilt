import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { newsletterUnsubscribeBody, newsletterConfirmQuery } from '@/lib/schemas/forms';
import * as newsletter from '@/lib/repositories/newsletter';

/**
 * /api/forms/newsletter/unsubscribe
 *
 * GET serves one-click links from an email footer; POST serves the preference
 * page. Both respond the same way for an unknown token — an opt-out request
 * should never fail visibly, and the response must not confirm membership.
 */
const message = { success: true, message: 'You have been unsubscribed.' };

export default createRoute({
  GET: {
    query: newsletterConfirmQuery,
    rateLimit: RATE_LIMITS.newsletter,
    handler: async ({ query }) => {
      await newsletter.unsubscribe(query.token);
      return message;
    },
  },

  POST: {
    body: newsletterUnsubscribeBody,
    rateLimit: RATE_LIMITS.newsletter,
    csrf: false,
    handler: async ({ body }) => {
      await newsletter.unsubscribe(body.token);
      return message;
    },
  },
});
