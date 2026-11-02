/**
 * First-party page-view recording, sent to /api/analytics/pageview only after
 * the visitor has allowed the Analytics cookie category.
 */

const MAX_LENGTH = 512;
const VISIT_KEY = 'cobuilt.visit';

/**
 * Origin and path only. Query strings and fragments can carry tokens (the
 * newsletter confirmation link does) or personal data from another site.
 */
export function sanitiseUrl(url: string, base?: string): string | undefined {
  try {
    const parsed = new URL(url, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return `${parsed.origin}${parsed.pathname}`.slice(0, MAX_LENGTH);
  } catch {
    return undefined;
  }
}

let fallbackVisitId: string | null = null;

/** A random id for this tab's visit, discarded when the tab closes. */
function visitId(): string {
  try {
    const existing = window.sessionStorage.getItem(VISIT_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(VISIT_KEY, created);
    return created;
  } catch {
    fallbackVisitId ??= crypto.randomUUID();
    return fallbackVisitId;
  }
}

export function sendPageView(path: string, referrer: string | undefined): void {
  void fetch('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: path.slice(0, MAX_LENGTH), referrer, sessionId: visitId() }),
    keepalive: true,
  }).catch(() => undefined);
}
