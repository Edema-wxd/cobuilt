import { z } from 'zod';
import { email } from './common';
import { ROLES } from '../auth/rbac';

/** `POST /api/auth/register` — an administrator inviting someone by email. */
export const registerBody = z.object({
  email,
  fullName: z.string().trim().min(2).max(255),
  role: z.enum(ROLES).optional(),
});

export const changeRoleBody = z.object({
  role: z.enum(ROLES),
  permissions: z
    .object({
      grant: z.array(z.string()).max(50).optional(),
      revoke: z.array(z.string()).max(50).optional(),
    })
    .optional(),
});
