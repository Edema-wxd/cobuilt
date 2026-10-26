import { spawn } from 'node:child_process';
import { chmod, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';

/**
 * PostgreSQL backups (§11: 7-day rolling retention) and the restore check that
 * proves they work. pg_dump and pg_restore must be on PATH, at the same major
 * version as the server or newer.
 */

const PREFIX = 'cobuilt-';
const SUFFIX = '.dump';
const HOUR_MS = 3_600_000;

export interface BackupFile {
  name: string;
  path: string;
  mtimeMs: number;
  bytes: number;
}

/**
 * libpq connection variables for a DATABASE_URL. Passing them through the
 * environment keeps the password out of the process list, where a URL on the
 * command line would show it to every user on the host.
 */
export function pgEnv(databaseUrl: string, ssl = false): Record<string, string> {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('Expected a postgres:// or postgresql:// URL');
  }

  const vars: Record<string, string> = {};
  const host = decodeURIComponent(url.hostname).replace(/^\[(.*)\]$/, '$1');
  if (host) vars.PGHOST = host;
  if (url.port) vars.PGPORT = url.port;
  if (url.username) vars.PGUSER = decodeURIComponent(url.username);
  if (url.password) vars.PGPASSWORD = decodeURIComponent(url.password);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database) vars.PGDATABASE = database;

  const sslmode = url.searchParams.get('sslmode') ?? (ssl ? 'verify-full' : null);
  if (sslmode) vars.PGSSLMODE = sslmode;
  // Matches the app's rejectUnauthorized: verify against the system CA store.
  if (sslmode === 'verify-full' && !process.env.PGSSLROOTCERT) vars.PGSSLROOTCERT = 'system';
  return vars;
}

export function backupFileName(now: Date): string {
  return `${PREFIX}${now.toISOString().replace(/[:.]/g, '-')}${SUFFIX}`;
}

export async function listBackups(dir: string): Promise<BackupFile[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(
    names
      .filter((name) => name.startsWith(PREFIX) && name.endsWith(SUFFIX))
      .map(async (name) => {
        const path = join(dir, name);
        const info = await stat(path);
        return { name, path, mtimeMs: info.mtimeMs, bytes: info.size };
      }),
  );
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/** Backups past retention, newest first in, never including the newest one. */
export function expiredBackups(
  newestFirst: BackupFile[],
  now: number,
  retentionDays: number,
): BackupFile[] {
  const cutoff = now - retentionDays * 24 * HOUR_MS;
  return newestFirst.slice(1).filter((file) => file.mtimeMs < cutoff);
}

export async function runBackup(options: {
  dir: string;
  databaseUrl: string;
  ssl?: boolean;
  retentionDays: number;
  now?: Date;
}): Promise<{ file: string; bytes: number; removed: string[] }> {
  const now = options.now ?? new Date();
  const env = pgEnv(options.databaseUrl, options.ssl);

  await mkdir(options.dir, { recursive: true, mode: 0o700 });
  const finalPath = join(options.dir, backupFileName(now));
  const partialPath = `${finalPath}.partial`;

  try {
    await exec('pg_dump', ['--format=custom', '--compress=9', '--file', partialPath], env);
    // The dump holds personal data; only the backup user may read it.
    await chmod(partialPath, 0o600);
    // A truncated or corrupt archive fails to list; catch that now, not at
    // restore time.
    await exec('pg_restore', ['--list', partialPath], env);
    await rename(partialPath, finalPath);
  } catch (error) {
    await rm(partialPath, { force: true });
    throw error;
  }

  const backups = await listBackups(options.dir);
  const removed = expiredBackups(backups, now.getTime(), options.retentionDays);
  await Promise.all(removed.map((file) => rm(file.path, { force: true })));
  await removeStalePartials(options.dir, now.getTime());

  const written = backups.find((file) => file.path === finalPath);
  return { file: finalPath, bytes: written?.bytes ?? 0, removed: removed.map((f) => f.name) };
}

async function removeStalePartials(dir: string, now: number): Promise<void> {
  for (const name of await readdir(dir)) {
    if (!name.endsWith(`${SUFFIX}.partial`)) continue;
    const path = join(dir, name);
    if ((await stat(path)).mtimeMs < now - 24 * HOUR_MS) await rm(path, { force: true });
  }
}

export interface RestoreCheckResult {
  file: string;
  ageHours: number;
  migrations: number;
  rows: Record<string, number>;
}

/**
 * Restores the newest backup into a scratch database, checks it, then empties
 * the scratch database again so no copy of the personal data is left there.
 */
export async function restoreCheck(options: {
  dir: string;
  targetUrl: string;
  liveUrl: string;
  ssl?: boolean;
  now?: number;
}): Promise<RestoreCheckResult> {
  const target = pgEnv(options.targetUrl, options.ssl);
  const live = pgEnv(options.liveUrl, options.ssl);
  if (!target.PGDATABASE || target.PGDATABASE === live.PGDATABASE) {
    throw new Error(
      'RESTORE_CHECK_DATABASE_URL must name a scratch database with a different name from the live one; it is wiped on every run',
    );
  }

  const [latest] = await listBackups(options.dir);
  if (!latest) throw new Error(`No backups found in ${options.dir}`);

  const client = new Client({
    connectionString: options.targetUrl,
    ssl: options.ssl ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  const listFile = join(tmpdir(), `cobuilt-restore-${process.pid}.list`);

  try {
    await resetSchema(client);
    // pg_trgm and pgcrypto are trusted extensions, so a database owner can
    // create them; restoring the dump's own CREATE EXTENSION would need a
    // superuser. The dump's extension entries are skipped below instead.
    await client.query(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    );

    const contents = await exec('pg_restore', ['--list', latest.path], target, true);
    const entries = contents.split('\n').filter((line) => !/\bEXTENSION\b/.test(line));
    await writeFile(listFile, entries.join('\n'), { mode: 0o600 });

    await exec(
      'pg_restore',
      [
        '--exit-on-error',
        '--no-owner',
        '--no-privileges',
        '--use-list',
        listFile,
        '--dbname',
        target.PGDATABASE,
        latest.path,
      ],
      target,
    );

    const migrations = Number(
      (await client.query<{ n: string }>('SELECT count(*)::text AS n FROM schema_migrations'))
        .rows[0]?.n ?? 0,
    );
    if (migrations === 0) throw new Error('Restored database has no applied migrations');

    const rows: Record<string, number> = {};
    for (const table of [
      'users',
      'projects',
      'passport_milestones',
      'form_submissions',
      'audit_log',
    ]) {
      const { rows: result } = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM ${table}`,
      );
      rows[table] = Number(result[0]?.n ?? 0);
    }

    return {
      file: latest.name,
      ageHours: ((options.now ?? Date.now()) - latest.mtimeMs) / HOUR_MS,
      migrations,
      rows,
    };
  } finally {
    await rm(listFile, { force: true });
    await resetSchema(client).catch(() => undefined);
    await client.end();
  }
}

async function resetSchema(client: Client): Promise<void> {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
}

/** Runs a client tool; resolves with stdout when asked for it, rejects with stderr. */
function exec(
  command: string,
  args: string[],
  pgVars: Record<string, string>,
  captureStdout = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...pgVars },
      stdio: ['ignore', captureStdout ? 'pipe' : 'ignore', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 8_000) stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with ${code}: ${stderr.trim() || 'no output'}`));
    });
  });
}
