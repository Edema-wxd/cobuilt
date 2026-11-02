import * as Sentry from '@sentry/node';
import { waitUntil } from '@vercel/functions';
import { env } from './env';

/**
 * Error reporting to Sentry, active only when SENTRY_DSN is set.
 *
 * Default integrations are off, so nothing is collected automatically: no
 * request bodies, headers, cookies or IP addresses. An event carries the error
 * and the context passed to reportError, and nothing else.
 */

type Context = Record<string, string | number | boolean | null | undefined>;

let started = false;

function ready(): boolean {
  if (!env.SENTRY_DSN) return false;
  if (!started) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      defaultIntegrations: false,
      beforeSend(event) {
        delete event.user;
        delete event.request;
        return event;
      },
    });
    started = true;
  }
  return true;
}

export function reportError(error: unknown, context: Context = {}): void {
  if (!ready()) return;
  Sentry.captureException(error, { extra: context });
  // Vercel can freeze a function as soon as it responds; keep it alive until
  // the report has been sent, without delaying the response.
  if (process.env.VERCEL) waitUntil(Sentry.flush(2000));
}

/** Sends queued reports before a long-running process exits. */
export async function flushErrorReports(timeoutMs = 2000): Promise<void> {
  if (started) await Sentry.flush(timeoutMs);
}
