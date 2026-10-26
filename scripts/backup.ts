#!/usr/bin/env tsx
import './loadEnv';
import { env } from '../src/lib/env';
import { runBackup } from '../src/lib/ops/backups';
import { sendAlert } from '../src/lib/ops/alerts';
import { flushErrorReports, reportError } from '../src/lib/monitoring';

/**
 * Nightly database backup, run from cron (ops/cron/cobuilt). Writes a
 * verified pg_dump archive to BACKUP_DIR and deletes archives older than
 * BACKUP_RETENTION_DAYS. Any failure sends a critical alert.
 */

// Archives and temp files are created readable by this user only.
process.umask(0o077);

async function main(): Promise<void> {
  if (!env.BACKUP_DIR) throw new Error('BACKUP_DIR is not set');

  const started = Date.now();
  const result = await runBackup({
    dir: env.BACKUP_DIR,
    databaseUrl: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
    retentionDays: env.BACKUP_RETENTION_DAYS,
  });

  console.log(
    `${new Date().toISOString()} backup ok: ${result.file} (${(result.bytes / 1_048_576).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(0)} s)` +
      (result.removed.length ? `; removed ${result.removed.join(', ')}` : ''),
  );
}

main()
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${new Date().toISOString()} backup FAILED: ${message}`);
    reportError(error, { source: 'backup' });
    await sendAlert({ severity: 'critical', title: 'Database backup failed', detail: message });
    await flushErrorReports();
    process.exit(1);
  });
