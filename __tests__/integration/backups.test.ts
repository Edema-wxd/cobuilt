import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { TEST_DATABASE_URL, resetDatabase } from '../setup/database';
import { listBackups, restoreCheck, runBackup } from '@/lib/ops/backups';
import { checkBackups } from '@/lib/ops/healthMonitor';

function hasPgTools(): boolean {
  try {
    execFileSync('pg_dump', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const describeWithTools = TEST_DATABASE_URL && hasPgTools() ? describe : describe.skip;

describeWithTools('database backups (real pg_dump and pg_restore)', () => {
  const liveUrl = TEST_DATABASE_URL!;
  const scratchName = `${new URL(liveUrl).pathname.slice(1)}_restore_check`;
  const scratchUrl = Object.assign(new URL(liveUrl), { pathname: `/${scratchName}` }).toString();
  let dir: string;

  async function onLive<T>(sql: string): Promise<T[]> {
    const client = new Client({ connectionString: liveUrl });
    await client.connect();
    try {
      return (await client.query(sql)).rows as T[];
    } finally {
      await client.end();
    }
  }

  beforeAll(async () => {
    await resetDatabase();
    // The migration runner creates this table in real deployments.
    await onLive(`CREATE TABLE schema_migrations (name text PRIMARY KEY, checksum text, applied_at timestamptz DEFAULT now());
                  INSERT INTO schema_migrations (name) VALUES ('0001_init.sql');
                  INSERT INTO users (email, password_hash, full_name, role) VALUES ('a@test.local', 'x', 'A', 'admin');`);
    await onLive(`DROP DATABASE IF EXISTS ${scratchName}`);
    await onLive(`CREATE DATABASE ${scratchName}`);
  }, 60_000);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cobuilt-backups-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await onLive(`DROP DATABASE IF EXISTS ${scratchName}`);
  });

  it('writes a verified archive readable only by its owner', async () => {
    const result = await runBackup({ dir, databaseUrl: liveUrl, retentionDays: 7 });

    expect(result.bytes).toBeGreaterThan(0);
    expect((await stat(result.file)).mode & 0o777).toBe(0o600);
    expect((await readdir(dir)).filter((n) => n.endsWith('.partial'))).toEqual([]);
  }, 60_000);

  it('removes archives past retention and keeps recent ones', async () => {
    const day = 24 * 3_600_000;
    for (const [name, age] of [
      ['cobuilt-old.dump', 10],
      ['cobuilt-recent.dump', 3],
    ] as const) {
      await writeFile(join(dir, name), 'x');
      const when = new Date(Date.now() - age * day);
      await utimes(join(dir, name), when, when);
    }

    const result = await runBackup({ dir, databaseUrl: liveUrl, retentionDays: 7 });

    expect(result.removed).toEqual(['cobuilt-old.dump']);
    expect((await listBackups(dir)).map((f) => f.name)).toContain('cobuilt-recent.dump');
  }, 60_000);

  it('leaves nothing behind when pg_dump fails', async () => {
    const badUrl = Object.assign(new URL(liveUrl), { pathname: '/no_such_database' }).toString();
    await expect(runBackup({ dir, databaseUrl: badUrl, retentionDays: 7 })).rejects.toThrow(
      /pg_dump exited/,
    );
    expect(await readdir(dir)).toEqual([]);
  }, 60_000);

  it('restores the newest archive into the scratch database, then wipes it', async () => {
    await runBackup({ dir, databaseUrl: liveUrl, retentionDays: 7 });

    const result = await restoreCheck({ dir, targetUrl: scratchUrl, liveUrl });

    expect(result.migrations).toBe(1);
    expect(result.rows.users).toBe(1);

    const scratch = new Client({ connectionString: scratchUrl });
    await scratch.connect();
    const { rows } = await scratch.query(
      `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`,
    );
    await scratch.end();
    expect(rows[0].n).toBe(0);
  }, 120_000);

  it('refuses to use the live database as the scratch database', async () => {
    await runBackup({ dir, databaseUrl: liveUrl, retentionDays: 7 });
    await expect(restoreCheck({ dir, targetUrl: liveUrl, liveUrl })).rejects.toThrow(
      /different name from the live one/,
    );
    expect((await onLive<{ n: number }>('SELECT count(*)::int AS n FROM users'))[0]!.n).toBe(1);
  }, 60_000);

  it('reports stale or missing backups to the monitor', async () => {
    expect(await checkBackups(dir, 26)).toMatchObject({
      ok: false,
      detail: expect.stringMatching(/No backups/),
    });

    await runBackup({ dir, databaseUrl: liveUrl, retentionDays: 7 });
    expect(await checkBackups(dir, 26)).toMatchObject({ ok: true });
    expect(await checkBackups(dir, 26, Date.now() + 27 * 3_600_000)).toMatchObject({
      ok: false,
      severity: 'critical',
    });
  }, 60_000);
});
