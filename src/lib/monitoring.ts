import * as Sentry from '@sentry/node';
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
      environment: env.NODE_ENV,
      release: process.env.npm_package_version,
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
}

/** Sends queued reports before a process exits. */
export async function flushErrorReports(timeoutMs = 2000): Promise<void> {
  if (started) await Sentry.flush(timeoutMs);
}

/** A URL's path without its query string, which can carry single-use tokens. */
export function pathOnly(url: string | undefined): string | undefined {
  return url?.split('?')[0];
}
