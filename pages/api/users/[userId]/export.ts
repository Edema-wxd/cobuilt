import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { forbidden, notFound } from '@/lib/http/errors';
import { query } from '@/lib/db';
import * as users from '@/lib/repositories/users';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * GET /api/users/[userId]/export — data subject access request (NDPA, §11).
 *
 * A user may export their own data; an admin may export anyone's. The spec's
 * sketch passes three statements in one `db.query` call, which node-postgres
 * rejects when parameters are bound — each dataset is fetched separately here.
 */
export default createRoute({
  GET: {
    query: z.object({ userId: z.string().uuid() }),
    auth: 'required',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query: params, auth, res, ip }) => {
      if (auth!.userId !== params.userId && auth!.role !== 'admin') {
        throw forbidden('You may only export your own data');
      }

      const user = await users.findById(params.userId);
      if (!user) throw notFound('User not found');

      const [submissions, pageViews, sessions, newsletter] = await Promise.all([
        query(
          `SELECT id, form_type, name, email, phone, message, metadata, submitted_at
             FROM form_submissions WHERE lower(email) = lower($1)`,
          [user.email],
        ),
        query(
          `SELECT page_path, referrer, viewed_at FROM page_views
            WHERE user_id = $1 ORDER BY viewed_at DESC LIMIT 5000`,
          [params.userId],
        ),
        query(
          `SELECT issued_at, expires_at, revoked_at, user_agent, host(ip_address) AS ip_address
             FROM refresh_tokens WHERE user_id = $1 ORDER BY issued_at DESC`,
          [params.userId],
        ),
        query(
          `SELECT email, full_name, confirmed_at, unsubscribed_at, subscribed_at
             FROM newsletter_subscribers WHERE lower(email) = lower($1)`,
          [user.email],
        ),
      ]);

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.USER_DATA_EXPORTED,
        entityType: 'user',
        entityId: params.userId,
        changes: { self: auth!.userId === params.userId },
        ipAddress: ip,
      });

      const document = {
        exportedAt: new Date().toISOString(),
        subject: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        },
        formSubmissions: submissions.rows,
        pageViews: pageViews.rows,
        sessions: sessions.rows,
        newsletter: newsletter.rows,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="user-data-${params.userId}.json"`,
      );
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(JSON.stringify(document, null, 2));
    },
  },
});
