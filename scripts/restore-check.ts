#!/usr/bin/env tsx
import './loadEnv';
import { env } from '../src/lib/env';
import { restoreCheck } from '../src/lib/ops/backups';
import { sendAlert } from '../src/lib/ops/alerts';
import { flushErrorReports, reportError } from '../src/lib/monitoring';

/**
 * Weekly proof that the backups can be restored, run from cron. Restores the
 * newest archive into RESTORE_CHECK_DATABASE_URL, checks it, and wipes that
 * scratch database again. Any failure sends a critical alert.
 */

process.umask(0o077);

async function main(): Promise<void> {
  if (!env.BACKUP_DIR) throw new Error('BACKUP_DIR is not set');
  if (!env.RESTORE_CHECK_DATABASE_URL) throw new Error('RESTORE_CHECK_DATABASE_URL is not set');

  const result = await restoreCheck({
    dir: env.BACKUP_DIR,
    targetUrl: env.RESTORE_CHECK_DATABASE_URL,
    liveUrl: env.DATABASE_URL,
    ssl: env.DATABASE_SSL,
  });

  const rows = Object.entries(result.rows)
    .map(([table, count]) => `${table}=${count}`)
    .join(' ');
  console.log(
    `${new Date().toISOString()} restore check ok: ${result.file} (${result.ageHours.toFixed(1)} h old), ${result.migrations} migrations, ${rows}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${new Date().toISOString()} restore check FAILED: ${message}`);
    reportError(error, { source: 'restore-check' });
    await sendAlert({
      severity: 'critical',
      title: 'Backup restore check failed',
      detail: `${message}\n\nThe latest backup may not be restorable. See "Backups" in docs/runbook.md.`,
    });
    await flushErrorReports();
    process.exit(1);
  });
