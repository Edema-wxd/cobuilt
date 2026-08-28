import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  readCookie,
  revokeRefreshToken,
} from '@/lib/auth/refreshTokens';

/**
 * POST /api/auth/logout — revokes the refresh token and clears the cookies.
 *
 * The access token stays valid until it expires (at most 15 minutes); that is
 * the accepted trade-off of stateless access tokens, and the reason their TTL
 * is short.
 */
export default createRoute({
  POST: {
    rateLimit: RATE_LIMITS.api,
    csrf: false,
    handler: async ({ req, res }) => {
      const token = readCookie(req, REFRESH_COOKIE);
      if (token) await revokeRefreshToken(token);

      clearAuthCookies(res);
      return { success: true };
    },
  },
});
