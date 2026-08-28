import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { resetPasswordBody } from '@/lib/schemas/auth';
import { badRequest } from '@/lib/http/errors';
import * as users from '@/lib/repositories/users';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { revokeAllForUser } from '@/lib/auth/refreshTokens';

/**
 * POST /api/auth/reset-password — consumes a reset token and sets a new password.
 *
 * Every existing session is revoked afterwards: a reset is usually a response
 * to a compromise, so any session an attacker holds must die with it.
 */
export default createRoute({
  POST: {
    body: resetPasswordBody,
    rateLimit: RATE_LIMITS.passwordReset,
    csrf: false,
    handler: async ({ body, ip }) => {
      const user = await users.consumePasswordReset(body.token, body.password);
      if (!user) throw badRequest('This reset link is invalid or has expired');

      await Promise.all([
        revokeAllForUser(user.id),
        audit.record({
          actorId: user.id,
          actorEmail: user.email,
          action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
          entityType: 'user',
          entityId: user.id,
          ipAddress: ip,
        }),
      ]);

      return { success: true, message: 'Your password has been reset. Please sign in.' };
    },
  },
});
