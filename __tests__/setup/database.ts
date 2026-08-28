import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

/**
 * Integration-test database.
 *
 * These tests run against a real PostgreSQL instance, because the queries they
 * cover — generated tsvector columns, array containment, ON CONFLICT upserts,
 * CHECK constraints — have no meaningful behaviour against a mock. They are
 * skipped when TEST_DATABASE_URL is unset so `npm test` still works on a
 * machine with no database.
 */

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

/** Drops and rebuilds the schema so each suite starts from a known state. */
export async function resetDatabase(): Promise<void> {
  if (!TEST_DATABASE_URL) return;

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();

  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      await client.query(await readFile(join(MIGRATIONS_DIR, file), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

export async function truncateAll(): Promise<void> {
  if (!TEST_DATABASE_URL) return;

  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();

  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
    );
    if (rows.length === 0) return;

    await client.query(
      `TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  } finally {
    await client.end();
  }
}
