'use client';

import { useEffect, useState } from 'react';

/** Long enough for any real page load; a link that never navigates gives up. */
const GIVE_UP_MS = 12000;

/**
 * An orange rule across the top of the window while the next page loads.
 *
 * The public site links with plain anchors, so every navigation is a full
 * document load and the old page sits still until the new one paints. This
 * fills that gap: a click on an internal link starts the bar, and the next
 * page replaces it. In-page anchors, new tabs, downloads and modified clicks
 * are left alone, since none of them unloads this page.
 */
export default function NavProgress() {
  const [run, setRun] = useState(0);

  useEffect(() => {
    function onClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const here = window.location;
      if (url.pathname === here.pathname && url.search === here.search) return;

      setRun((count) => count + 1);
    }

    // Coming back through the back-forward cache restores this page as it was
    // left, bar and all.
    function onPageShow(event: PageTransitionEvent): void {
      if (event.persisted) setRun(0);
    }

    document.addEventListener('click', onClick);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!run) return;
    const timer = window.setTimeout(() => setRun(0), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [run]);

  if (!run) return null;
  return (
    <div
      key={run}
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-60 h-[3px] bg-orange"
      aria-hidden="true"
    />
  );
}
