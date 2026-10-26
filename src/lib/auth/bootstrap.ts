import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { email } from '../schemas/common';
import { password } from '../schemas/auth';
import * as users from '../repositories/users';
import * as audit from '../repositories/audit';
import { AUDIT_ACTIONS } from '../repositories/audit';

const adminInput = z.object({
  email,
  fullName: z.string().trim().min(2).max(255),
  password: password.optional(),
});

export type CreateAdminResult =
  | { status: 'created'; userId: string; email: string; generatedPassword: string | null }
  | { status: 'exists'; email: string };

/**
 * Creates an admin account from the command line (scripts/create-admin.ts).
 * Runs with direct database access, so it needs no HTTP endpoint that an
 * unauthenticated caller could reach.
 */
export async function createAdmin(input: {
  email: string;
  fullName: string;
  password?: string;
}): Promise<CreateAdminResult> {
  const parsed = adminInput.parse(input);

  const existing = await users.findByEmail(parsed.email);
  if (existing) return { status: 'exists', email: parsed.email };

  const generatedPassword = parsed.password ? null : randomBytes(18).toString('base64url');
  const user = await users.create({
    email: parsed.email,
    fullName: parsed.fullName,
    password: parsed.password ?? generatedPassword!,
    role: 'admin',
  });

  await audit.record({
    actorId: null,
    actorEmail: null,
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: 'user',
    entityId: user.id,
    changes: { email: user.email, role: user.role, via: 'cli' },
  });

  return { status: 'created', userId: user.id, email: user.email, generatedPassword };
}
