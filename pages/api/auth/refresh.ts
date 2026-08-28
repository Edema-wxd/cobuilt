import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { unauthorized, forbidden } from '@/lib/http/errors';
import * as users from '@/lib/repositories/users';
import { signAccessToken } from '@/lib/auth/jwt';
import { effectivePermissions } from '@/lib/auth/rbac';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  readCookie,
  rotateRefreshToken,
  setAuthCookies,
} from '@/lib/auth/refreshTokens';
import { generateCsrfToken } from '@/lib/http/csrf';
import { env } from '@/lib/env';

/**
 * POST /api/auth/refresh — exchanges the refresh cookie for a new access token.
 *
 * The refresh token rotates on every use; presenting a rotated token revokes
 * the whole family (see lib/auth/refreshTokens.ts).
 */
export default createRoute({
  POST: {
    rateLimit: RATE_LIMITS.api,
    // The refresh cookie is SameSite=Strict and scoped to /api/auth, and the
    // rotation check below is the real protection against replay.
    csrf: false,
    handler: async ({ req, res, ip, userAgent }) => {
      const token = readCookie(req, REFRESH_COOKIE);
      if (!token) throw unauthorized('No refresh token');

      const rotated = await rotateRefreshToken({ token, userAgent, ipAddress: ip });
      if (!rotated) {
        clearAuthCookies(res);
        throw unauthorized('Refresh token is invalid or expired');
      }

      const user = await users.findById(rotated.userId);
      if (!user || !user.is_active) {
        clearAuthCookies(res);
        throw forbidden('This account is no longer active');
      }

      const permissions = effectivePermissions(user.role, user.permissions);

      const csrfToken = generateCsrfToken();
      setAuthCookies(res, {
        refreshToken: rotated.token,
        expiresAt: rotated.expiresAt,
        csrfToken,
      });

      return {
        accessToken: signAccessToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          permissions: [...permissions],
        }),
        expiresIn: env.JWT_ACCESS_TTL_SECONDS,
        tokenType: 'Bearer',
        csrfToken,
      };
    },
  },
});
