'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CONSENT_CHANGED_EVENT, read } from './cookieConsent';
import { sanitiseUrl, sendPageView } from './pageViews';

// Module state, not refs: each page renders its own SiteLayout, so this
// component remounts on every navigation and must remember the last page.
let currentPath: string | null = null;
let currentReferrer: string | null = null;
let recorded = false;

function enter(path: string): void {
  if (path === currentPath) return;
  currentReferrer = currentPath;
  currentPath = path;
  recorded = false;
}

function record(): void {
  if (recorded || !currentPath || !read()?.analytics) return;
  recorded = true;
  const referrer = currentReferrer
    ? sanitiseUrl(currentReferrer, window.location.origin)
    : document.referrer
      ? sanitiseUrl(document.referrer)
      : undefined;
  sendPageView(currentPath, referrer);
}

/** Records each public page once the visitor has allowed analytics. */
export default function PageViews() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    enter(pathname);
    record();

    // Counts the page the visitor is on when they accept, not only the next one.
    window.addEventListener(CONSENT_CHANGED_EVENT, record);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, record);
  }, [pathname]);

  return null;
}
