#!/usr/bin/env tsx
import './loadEnv';
import { configuredChecks } from '../src/lib/ops/healthMonitor';
import { sendAlert } from '../src/lib/ops/alerts';

/**
 * Runs every monitoring check once and prints the result, to confirm the
 * worker's configuration from a shell. With --test-alert, also sends a test
 * alert through each configured channel.
 *
 *   npm run ops:check
 *   npm run ops:check -- --test-alert
 */

async function main(): Promise<number> {
  let failing = 0;
  for (const check of configuredChecks()) {
    const result = await check.run();
    const status = !result
      ? 'SKIP'
      : result.ok
        ? 'OK  '
        : result.severity === 'critical'
          ? 'FAIL'
          : 'WARN';
    if (result && !result.ok) failing += 1;
    console.log(
      `${status}  ${check.name}: ${result?.detail ?? 'could not be read (is Redis up?)'}`,
    );
  }

  if (process.argv.includes('--test-alert')) {
    const delivered = await sendAlert({
      severity: 'warning',
      title: 'Test alert',
      detail:
        'Sent by `npm run ops:check -- --test-alert`. If you can read this, alerts reach you.',
    });
    console.log(
      delivered
        ? 'Test alert sent.'
        : 'Test alert reached no channel: set ALERT_WEBHOOK_URL or ALERT_EMAIL.',
    );
    if (!delivered) failing += 1;
  }

  return failing === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
