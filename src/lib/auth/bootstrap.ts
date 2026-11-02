import { z } from 'zod';
import { email } from '../schemas/common';
import * as users from '../repositories/users';
import * as audit from '../repositories/audit';
import { AUDIT_ACTIONS } from '../repositories/audit';

const inviteInput = z.object({
  email,
  fullName: z.string().trim().min(2).max(255),
});

export type InviteAdminResult =
  | { status: 'invited'; userId: string; email: string }
  | { status: 'exists'; email: string; role: string };

/**
 * Invites an administrator from the command line (scripts/invite-admin.ts).
 * This creates the account but no credentials: the person signs up with Neon
 * Auth at /admin/register using the same address, and the two are linked on
 * their first verified sign-in. Writing to the database directly means no
 * endpoint ever has to be opened to unauthenticated sign-up.
 */
export async function inviteAdmin(input: {
  email: string;
  fullName: string;
}): Promise<InviteAdminResult> {
  const parsed = inviteInput.parse(input);

  const existing = await users.findByEmail(parsed.email);
  if (existing) return { status: 'exists', email: existing.email, role: existing.role };

  const user = await users.create({ email: parsed.email, fullName: parsed.fullName, role: 'admin' });

  await audit.record({
    actorId: null,
    actorEmail: null,
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: 'user',
    entityId: user.id,
    changes: { email: user.email, role: user.role, via: 'cli' },
  });

  return { status: 'invited', userId: user.id, email: user.email };
}
