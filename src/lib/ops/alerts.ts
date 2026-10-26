import { env } from '../env';
import { logger } from '../logger';
import { sendEmail } from '../mail';
import { operationsAlert } from '../mail/templates';

export type Severity = 'critical' | 'warning' | 'resolved';

export interface Alert {
  severity: Severity;
  title: string;
  detail: string;
}

/**
 * Sends an operations alert to the webhook and the alert inbox, directly
 * rather than through the job queue: the queue needs Redis, which may be the
 * thing that is down. Returns whether at least one channel accepted it.
 * Alerts describe systems, never people, so no personal data goes out here.
 */
export async function sendAlert(alert: Alert): Promise<boolean> {
  const level =
    alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warn' : 'info';
  logger.log(level, `Alert: ${alert.title}`, { severity: alert.severity, detail: alert.detail });

  const deliveries = await Promise.all([toWebhook(alert), toEmail(alert)]);
  const delivered = deliveries.some(Boolean);

  if (!delivered) {
    logger.error('Alert reached no channel; set ALERT_WEBHOOK_URL or ALERT_EMAIL', {
      title: alert.title,
    });
  }
  return delivered;
}

async function toWebhook(alert: Alert): Promise<boolean> {
  if (!env.ALERT_WEBHOOK_URL) return false;
  try {
    const response = await fetch(env.ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.detail}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    logger.error('Alert webhook failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function toEmail(alert: Alert): Promise<boolean> {
  // The log transport writes to the logger, which is not a way to reach anyone.
  if (!env.ALERT_EMAIL || env.MAIL_PROVIDER === 'log') return false;
  try {
    await sendEmail({ ...operationsAlert(alert), to: env.ALERT_EMAIL });
    return true;
  } catch (error) {
    logger.error('Alert email failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
