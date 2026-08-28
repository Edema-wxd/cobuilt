import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { forbidden, notFound } from '@/lib/http/errors';
import * as users from '@/lib/repositories/users';
import * as forms from '@/lib/repositories/forms';
import * as newsletter from '@/lib/repositories/newsletter';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { revokeAllForUser } from '@/lib/auth/refreshTokens';
import { serializeUser } from '@/lib/serializers';

/**
 * /api/users/[userId]
 *   GET    — profile (self or admin)
 *   DELETE — erasure request (NDPA, §11)
 *
 * Erasure soft-deletes the account, releases the email address, anonymises
 * every form submission from that address and removes the newsletter record.
 * The audit trail keeps the actor's email by design: it is the record that the
 * erasure happened, and it is what an NDPA audit asks for.
 */
export default createRoute({
  GET: {
    query: z.object({ userId: z.string().uuid() }),
    auth: 'required',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth }) => {
      if (auth!.userId !== query.userId && auth!.role !== 'admin') {
        throw forbidden('You may only view your own profile');
      }

      const user = await users.findById(query.userId);
      if (!user) throw notFound('User not found');

      return serializeUser(user);
    },
  },

  DELETE: {
    query: z.object({ userId: z.string().uuid() }),
    auth: 'required',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query, auth, ip }) => {
      if (auth!.userId !== query.userId && auth!.role !== 'admin') {
        throw forbidden('You may only delete your own account');
      }

      const user = await users.findById(query.userId);
      if (!user) throw notFound('User not found');

      const email = user.email;
      const deleted = await users.softDelete(query.userId);
      if (!deleted) throw notFound('User not found');

      const [submissionsAnonymised, newsletterRemoved] = await Promise.all([
        forms.anonymiseByEmail(email),
        newsletter.deleteByEmail(email),
        revokeAllForUser(query.userId),
      ]);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.USER_DELETED,
        entityType: 'user',
        entityId: query.userId,
        changes: { self: auth!.userId === query.userId, submissionsAnonymised, newsletterRemoved },
        ipAddress: ip,
      });

      return {
        success: true,
        message: 'The account and its associated personal data have been removed.',
        submissionsAnonymised,
        newsletterRemoved,
      };
    },
  },
});
