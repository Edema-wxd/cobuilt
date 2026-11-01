import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { invalidatePrefix } from '@/lib/cache';
import { conflict } from '@/lib/http/errors';
import { reorderLeadershipBody } from '@/lib/schemas/leadership';
import * as leadership from '@/lib/repositories/leadership';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';
import { serializeLeaderForAdmin } from '@/lib/serializers';

/**
 * POST /api/admin/leadership/reorder — sets the running order.
 *
 * Takes every leader's id in the new order. A list that no longer matches the
 * table (someone added or removed a leader since the screen loaded) is a 409,
 * so the editor reloads rather than saving an order built on a stale list.
 */
export default createRoute({
  POST: {
    body: reorderLeadershipBody,
    roles: ['admin', 'editor'],
    permission: 'leadership:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip }) => {
      if (!(await leadership.reorderLeadership(body.ids))) {
        throw conflict('The list of leaders has changed. Reload it and try again.');
      }

      await audit.record({
        actorId: auth!.userId,
        actorEmail: auth!.email,
        action: AUDIT_ACTIONS.LEADERSHIP_REORDERED,
        entityType: 'leader',
        changes: { order: body.ids },
        ipAddress: ip,
      });

      await invalidatePrefix('leadership');

      return { results: (await leadership.listAllLeadership()).map(serializeLeaderForAdmin) };
    },
  },
});
