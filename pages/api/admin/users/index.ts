import { z } from 'zod';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { ROLES } from '@/lib/auth/rbac';
import { queryBoolean } from '@/lib/schemas/common';
import * as users from '@/lib/repositories/users';
import { serializeUser } from '@/lib/serializers';

/** GET /api/admin/users — account list with roles and activity (§3). */
export default createRoute({
  GET: {
    query: z.object({
      role: z.enum(ROLES).optional(),
      isActive: queryBoolean.optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
    roles: ['admin'],
    permission: 'users:read',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ query }) => {
      const page = await users.list(query);
      return { ...page, results: page.results.map(serializeUser) };
    },
  },
});
