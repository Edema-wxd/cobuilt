import { useEffect } from 'react';
import { useRouter } from 'next/router';

const MAX_LENGTH = 512;
const VISIT_KEY = 'cobuilt_visit';

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

export function pathOf(url: string, base: string): string {
  return new URL(url, base).pathname.slice(0, MAX_LENGTH);
}

export function trackingAllowed(nav: { doNotTrack?: string | null }): boolean {
  const gpc = (nav as { globalPrivacyControl?: boolean }).globalPrivacyControl;
  return nav.doNotTrack !== '1' && gpc !== true;
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

function send(path: string, referrer: string | undefined): void {
  void fetch('/api/analytics/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, referrer, sessionId: visitId() }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Records the landing page, then every client-side navigation. */
export function usePageViews(): void {
  const router = useRouter();

  useEffect(() => {
    if (!trackingAllowed(navigator)) return;

    let previous = window.location.pathname;
    send(previous, document.referrer ? sanitiseUrl(document.referrer) : undefined);

    const onRouteChange = (url: string) => {
      const path = pathOf(url, window.location.origin);
      if (path === previous) return;
      send(path, sanitiseUrl(previous, window.location.origin));
      previous = path;
    };

    router.events.on('routeChangeComplete', onRouteChange);
    return () => router.events.off('routeChangeComplete', onRouteChange);
  }, [router.events]);
}
