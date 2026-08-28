import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import * as audit from '@/lib/repositories/audit';

/** GET /api/admin/audit-log — the system audit trail (§3). */
export default createRoute({
  GET: {
    query: z.object({
      action: z.string().max(100).optional(),
      entityType: z.string().max(100).optional(),
      actorId: z.string().uuid().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
    }),
    roles: ['admin'],
    permission: 'audit:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const page = await audit.list(query);

      return {
        ...page,
        results: page.results.map((row) => ({
          id: row.id,
          actor: { id: row.actor_id, email: row.actor_email },
          action: row.action,
          entity: { type: row.entity_type, id: row.entity_id },
          changes: row.changes,
          ipAddress: row.ip_address,
          createdAt: row.created_at,
        })),
      };
    },
  },
});
