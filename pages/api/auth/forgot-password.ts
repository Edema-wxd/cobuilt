import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { forgotPasswordBody } from '@/lib/schemas/auth';
import * as users from '@/lib/repositories/users';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { enqueueEmail } from '@/lib/queues';

/**
 * POST /api/auth/forgot-password.
 *
 * Always responds 200 with the same body, whether or not the address is
 * registered: a different response would turn this into an account-enumeration
 * endpoint.
 */
const response = {
  success: true,
  message: 'If an account exists for that address, a reset link has been sent.',
};

export default createRoute({
  POST: {
    body: forgotPasswordBody,
    rateLimit: RATE_LIMITS.passwordReset,
    csrf: false,
    handler: async ({ body, ip }) => {
      const reset = await users.createPasswordReset(body.email);
      if (!reset) return response;

      await Promise.all([
        enqueueEmail({
          type: 'password-reset',
          to: reset.user.email,
          payload: { token: reset.token, fullName: reset.user.full_name },
        }),
        audit.record({
          actorId: reset.user.id,
          actorEmail: reset.user.email,
          action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
          entityType: 'user',
          entityId: reset.user.id,
          ipAddress: ip,
        }),
      ]);

      return response;
    },
  },
});
