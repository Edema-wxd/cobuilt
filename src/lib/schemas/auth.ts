import { z } from 'zod';
import { email } from './common';
import { ROLES } from '../auth/rbac';

/**
 * Password policy: length is the property that actually resists offline
 * cracking, so a 12-character minimum is required rather than a character-class
 * checklist that pushes users toward "Password1!".
 */
export const password = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const registerBody = z.object({
  email,
  password,
  fullName: z.string().trim().min(2).max(255),
  role: z.enum(ROLES).optional(),
});

export const forgotPasswordBody = z.object({ email });

export const resetPasswordBody = z.object({
  token: z.string().min(32).max(128),
  password,
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
