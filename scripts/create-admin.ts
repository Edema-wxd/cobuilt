#!/usr/bin/env tsx
import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import { createAdmin } from '../src/lib/auth/bootstrap';
import { pool } from '../src/lib/db';

/**
 * Creates an admin account directly in the database.
 *
 *   npm run user:create-admin -- --email admin@cobuilt.com --name "Full Name"
 *
 * The password is read from ADMIN_PASSWORD, never from the command line, where
 * it would land in shell history and the process list. Without it, a random
 * password is generated and printed once.
 */

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
  });

  if (!values.email || !values.name) {
    console.error('Usage: npm run user:create-admin -- --email <address> --name "<full name>"');
    return 2;
  }

  try {
    const result = await createAdmin({
      email: values.email,
      fullName: values.name,
      password: process.env.ADMIN_PASSWORD || undefined,
    });

    if (result.status === 'exists') {
      console.error(`An account for ${result.email} already exists. Nothing was changed.`);
      return 1;
    }

    console.log(`Admin account created for ${result.email}.`);
    if (result.generatedPassword) {
      console.log(`Generated password (shown once): ${result.generatedPassword}`);
    }
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
