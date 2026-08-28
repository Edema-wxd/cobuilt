#!/usr/bin/env tsx
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/**
 * Migration runner.
 *
 * Each file in db/migrations runs once, inside a transaction, in filename
 * order, and is recorded in schema_migrations with a checksum. An already
 * applied file whose contents changed is a hard error: editing a migration
 * that has run in another environment produces schemas that silently diverge.
 *
 *   npm run db:migrate          apply pending migrations
 *   npm run db:migrate:status   list applied and pending
 */

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

async function loadMigrations(): Promise<MigrationFile[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
      const { createHash } = await import('node:crypto');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

async function connect(): Promise<Client> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  return client;
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) PRIMARY KEY,
      checksum   VARCHAR(64)  NOT NULL,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function up(): Promise<void> {
  const client = await connect();

  try {
    await ensureMigrationsTable(client);

    const migrations = await loadMigrations();
    const { rows } = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM schema_migrations',
    );
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    for (const migration of migrations) {
      const appliedChecksum = applied.get(migration.name);

      if (appliedChecksum) {
        if (appliedChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} was modified after it was applied. ` +
              'Add a new migration instead of editing an applied one.',
          );
        }
        continue;
      }

      process.stdout.write(`Applying ${migration.name} ... `);

      // DDL is transactional in PostgreSQL, so a failed migration leaves no
      // half-applied schema behind.
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [migration.name, migration.checksum],
        );
        await client.query('COMMIT');
        process.stdout.write('done\n');
      } catch (error) {
        await client.query('ROLLBACK');
        process.stdout.write('failed\n');
        throw error;
      }
    }

    const pending = migrations.filter((m) => !applied.has(m.name)).length;
    console.log(pending === 0 ? 'Database is up to date.' : `Applied ${pending} migration(s).`);
  } finally {
    await client.end();
  }
}

async function status(): Promise<void> {
  const client = await connect();

  try {
    await ensureMigrationsTable(client);

    const migrations = await loadMigrations();
    const { rows } = await client.query<{ name: string; applied_at: Date }>(
      'SELECT name, applied_at FROM schema_migrations',
    );
    const applied = new Map(rows.map((r) => [r.name, r.applied_at]));

    for (const migration of migrations) {
      const at = applied.get(migration.name);
      console.log(
        at
          ? `  applied  ${migration.name}  (${at.toISOString()})`
          : `  pending  ${migration.name}`,
      );
    }
  } finally {
    await client.end();
  }
}

const command = process.argv[2] ?? 'up';

(command === 'status' ? status() : up()).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
