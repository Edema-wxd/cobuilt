import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS, reset } from '@/lib/rateLimit';
import { loginBody } from '@/lib/schemas/auth';
import { unauthorized, forbidden } from '@/lib/http/errors';
import * as users from '@/lib/repositories/users';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { burnPasswordComparison, verifyPassword } from '@/lib/auth/password';
import { signAccessToken } from '@/lib/auth/jwt';
import { effectivePermissions } from '@/lib/auth/rbac';
import { issueRefreshToken, setAuthCookies } from '@/lib/auth/refreshTokens';
import { generateCsrfToken } from '@/lib/http/csrf';
import { env } from '@/lib/env';
import { serializeUser } from '@/lib/serializers';

/**
 * POST /api/auth/login (§4).
 *
 * Returns a 15-minute access token in the body and sets an HTTP-only refresh
 * cookie plus the readable CSRF cookie that pairs with it.
 */
export default createRoute({
  POST: {
    body: loginBody,
    rateLimit: RATE_LIMITS.login,
    // Rate-limit on the email as well as the IP so a botnet cannot spread a
    // password-spraying attack on one account across many addresses.
    rateLimitKey: (req, ip) => {
      const email = (req.body as { email?: unknown })?.email;
      return typeof email === 'string' ? `${email.toLowerCase()}` : (ip ?? 'unknown');
    },
    csrf: false,
    handler: async ({ body, res, ip, userAgent }) => {
      const user = await users.findByEmail(body.email);

      if (!user) {
        // Spend the same time as a real comparison so response timing does not
        // reveal whether the account exists.
        await burnPasswordComparison();
        throw unauthorized('Invalid email or password');
      }

      const passwordValid = await verifyPassword(body.password, user.password_hash);

      if (!passwordValid) {
        await audit.record({
          actorId: user.id,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          entityType: 'user',
          entityId: user.id,
          ipAddress: ip,
        });
        throw unauthorized('Invalid email or password');
      }

      if (!user.is_active) throw forbidden('This account has been deactivated');

      const permissions = effectivePermissions(user.role, user.permissions);

      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: [...permissions],
      });

      const refresh = await issueRefreshToken({ userId: user.id, userAgent, ipAddress: ip });
      const csrfToken = generateCsrfToken();
      setAuthCookies(res, {
        refreshToken: refresh.token,
        expiresAt: refresh.expiresAt,
        csrfToken,
      });

      await Promise.all([
        users.recordLogin(user.id),
        audit.record({
          actorId: user.id,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
          entityType: 'user',
          entityId: user.id,
          ipAddress: ip,
        }),
        // A successful login clears the throttle so a user who mistyped their
        // password twice is not locked out of their next session.
        reset(RATE_LIMITS.login, body.email.toLowerCase()),
      ]);

      return {
        accessToken,
        expiresIn: env.JWT_ACCESS_TTL_SECONDS,
        tokenType: 'Bearer',
        csrfToken,
        user: serializeUser(user),
        permissions: [...permissions],
      };
    },
  },
});
