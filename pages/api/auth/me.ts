import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { unauthorized } from '@/lib/http/errors';
import * as users from '@/lib/repositories/users';
import { serializeUser } from '@/lib/serializers';

/** GET /api/auth/me — the signed-in user's profile and effective permissions. */
export default createRoute({
  GET: {
    auth: 'required',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ auth }) => {
      const user = await users.findById(auth!.userId);
      // The token verified, but the account may have been deleted since.
      if (!user) throw unauthorized('Account no longer exists');

      return { user: serializeUser(user), permissions: [...auth!.permissions] };
    },
  },
});
