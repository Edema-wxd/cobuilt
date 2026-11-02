#!/usr/bin/env tsx
import './loadEnv';
import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import { inviteAdmin } from '../src/lib/auth/bootstrap';
import { env } from '../src/lib/env';
import { pool } from '../src/lib/db';

/**
 * Invites an administrator, for the first admin in a fresh environment or to
 * recover when every admin is locked out:
 *
 *   npm run user:invite-admin -- --email admin@cobuilt.com --name "Full Name"
 */

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
  });

  if (!values.email || !values.name) {
    console.error('Usage: npm run user:invite-admin -- --email <address> --name "<full name>"');
    return 2;
  }

  try {
    const result = await inviteAdmin({ email: values.email, fullName: values.name });

    if (result.status === 'exists') {
      console.error(
        `An account for ${result.email} already exists (role: ${result.role}). Nothing was changed.`,
      );
      return 1;
    }

    console.log(`Admin account created for ${result.email}.`);
    console.log(
      `Next: they sign up at ${env.NEXT_PUBLIC_WEBSITE_URL}/admin/register with this address and confirm the emailed code.`,
    );
    return 0;
  } catch (error) {
    if (error instanceof ZodError) {
      for (const issue of error.issues) console.error(`${issue.path.join('.')}: ${issue.message}`);
      return 2;
    }
    throw error;
  }
}

main()
  .then(async (code) => {
    await pool.end();
    process.exit(code);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await pool.end();
    process.exit(1);
  });
