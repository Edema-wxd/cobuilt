import { env } from '../env';
import { logger } from '../logger';
import { getQueue, QUEUE_NAMES } from '../queues';
import { listBackups } from './backups';
import { sendAlert, type Severity } from './alerts';

/**
 * Watches /api/health, backup freshness and email delivery from the worker,
 * and alerts on the thresholds in docs/runbook.md:
 *
 *   critical (down, unreachable, backups stale): 2 consecutive failed checks
 *   warning (degraded, email failures):          sustained for 15 minutes
 *
 * It runs on a plain timer, not a queue job, so it keeps working when Redis is
 * down. It cannot report its own death: an external uptime check on the public
 * /api/health remains necessary.
 */

export interface Observation {
  ok: boolean;
  severity: Exclude<Severity, 'resolved'>;
  detail: string;
}

export interface CheckState {
  failingSince: number | null;
  consecutiveCritical: number;
  alerted: Observation['severity'] | null;
  alertedAt: number | null;
}

export const INITIAL_STATE: CheckState = {
  failingSince: null,
  consecutiveCritical: 0,
  alerted: null,
  alertedAt: null,
};

const CRITICAL_AFTER_CHECKS = 2;
const WARNING_AFTER_MS = 15 * 60_000;
const EMAIL_FAILURES_PER_HOUR = 10;

export function advance(
  state: CheckState,
  observation: Observation,
  now: number,
  repeatMs: number,
): { state: CheckState; alert: { severity: Severity; detail: string } | null } {
  if (observation.ok) {
    return {
      state: INITIAL_STATE,
      alert: state.alerted ? { severity: 'resolved', detail: observation.detail } : null,
    };
  }

  const failingSince = state.failingSince ?? now;
  const consecutiveCritical =
    observation.severity === 'critical' ? state.consecutiveCritical + 1 : 0;
  const due =
    observation.severity === 'critical'
      ? consecutiveCritical >= CRITICAL_AFTER_CHECKS
      : now - failingSince >= WARNING_AFTER_MS;
  const escalated = state.alerted === 'warning' && observation.severity === 'critical';
  const repeat = state.alertedAt !== null && now - state.alertedAt >= repeatMs;
  const send = due && (state.alerted === null || escalated || repeat);

  return {
    state: {
      failingSince,
      consecutiveCritical,
      alerted: send ? observation.severity : state.alerted,
      alertedAt: send ? now : state.alertedAt,
    },
    alert: send ? { severity: observation.severity, detail: observation.detail } : null,
  };
}

export async function checkHealthUrl(url: string): Promise<Observation> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    // fetch wraps the network error in `cause`; read it structurally, since
    // errors from undici are not always instances of this realm's Error.
    const failure = error as { message?: string; cause?: { message?: string } } | null;
    const reason = failure?.cause?.message ?? failure?.message ?? String(error);
    return { ok: false, severity: 'critical', detail: `Unreachable: ${reason}` };
  }

  const body = (await response.json().catch(() => null)) as {
    status?: string;
    degraded?: string[];
  } | null;

  if (response.ok && body?.status === 'healthy') {
    return { ok: true, severity: 'warning', detail: 'Healthy' };
  }
  if (response.ok && body?.status === 'degraded') {
    return {
      ok: false,
      severity: 'warning',
      detail: `Degraded: ${(body.degraded ?? []).join(', ') || 'unknown dependency'}`,
    };
  }
  return {
    ok: false,
    severity: 'critical',
    detail: `HTTP ${response.status}, status ${body?.status ?? 'unreadable'}`,
  };
}

export async function checkBackups(
  dir: string,
  maxAgeHours: number,
  now = Date.now(),
): Promise<Observation> {
  const [latest] = await listBackups(dir);
  if (!latest) return { ok: false, severity: 'critical', detail: `No backups found in ${dir}` };

  const ageHours = (now - latest.mtimeMs) / 3_600_000;
  const summary = `Latest backup ${latest.name} is ${ageHours.toFixed(1)} h old`;
  return ageHours > maxAgeHours
    ? { ok: false, severity: 'critical', detail: `${summary}; the limit is ${maxAgeHours} h` }
    : { ok: true, severity: 'critical', detail: summary };
}

/** Returns null when Redis cannot be read; /api/health already reports that. */
export async function checkEmailQueue(now = Date.now()): Promise<Observation | null> {
  try {
    const failed = await Promise.race([
      getQueue(QUEUE_NAMES.email).getFailed(0, 199),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5_000)),
    ]);
    const recent = failed.filter((job) => (job.finishedOn ?? 0) > now - 3_600_000).length;
    return recent > EMAIL_FAILURES_PER_HOUR
      ? {
          ok: false,
          severity: 'warning',
          detail: `${recent} emails failed permanently in the last hour; enquiries and confirmations are not being delivered`,
        }
      : { ok: true, severity: 'warning', detail: `${recent} email failures in the last hour` };
  } catch {
    return null;
  }
}

export interface Check {
  name: string;
  run: () => Promise<Observation | null>;
}

export function configuredChecks(): Check[] {
  const checks: Check[] = env.HEALTHCHECK_URLS.map((url) => ({
    name: `Health check ${url}`,
    run: () => checkHealthUrl(url),
  }));
  if (env.BACKUP_DIR) {
    const dir = env.BACKUP_DIR;
    checks.push({
      name: 'Database backups',
      run: () => checkBackups(dir, env.BACKUP_MAX_AGE_HOURS),
    });
  }
  checks.push({ name: 'Email delivery', run: () => checkEmailQueue() });
  return checks;
}

const TITLES: Record<Severity, (name: string) => string> = {
  critical: (name) => `${name} is failing`,
  warning: (name) => `${name} needs attention`,
  resolved: (name) => `${name} has recovered`,
};

export function startHealthMonitor(checks: Check[] = configuredChecks()): {
  runOnce: (now?: number) => Promise<void>;
  stop: () => void;
} {
  const states = new Map<string, CheckState>();
  const repeatMs = env.ALERT_REPEAT_HOURS * 3_600_000;
  let running = false;

  async function runOnce(now = Date.now()): Promise<void> {
    for (const check of checks) {
      const observation = await check.run().catch(
        (error: unknown): Observation => ({
          ok: false,
          severity: 'critical',
          detail: `The check itself failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
      if (!observation) continue;

      const { state, alert } = advance(
        states.get(check.name) ?? INITIAL_STATE,
        observation,
        now,
        repeatMs,
      );
      states.set(check.name, state);
      if (alert) {
        await sendAlert({
          severity: alert.severity,
          title: TITLES[alert.severity](check.name),
          detail: alert.detail,
        });
      }
    }
  }

  const tick = () => {
    if (running) return;
    running = true;
    runOnce()
      .catch((error: unknown) =>
        logger.error('Health monitor run failed', {
          error: error instanceof Error ? error.message : String(error),
        }),
      )
      .finally(() => {
        running = false;
      });
  };

  tick();
  const timer = setInterval(tick, env.HEALTHCHECK_INTERVAL_SECONDS * 1000);
  return { runOnce, stop: () => clearInterval(timer) };
}
