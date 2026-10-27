'use client';

import { useEffect } from 'react';

const TARGETS = '.reveal, .reveal-stagger';

function inView(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

/**
 * Drives the scroll entrances defined in styles/globals.css.
 *
 * Anything marked `reveal` (or `reveal-stagger`, whose children rise in turn)
 * is hidden until it scrolls into view, then rises in once. Nothing is hidden
 * until this has run: it adds `motion-ready` to <html> only after it has
 * marked what is already on screen, in the same task, so content the visitor
 * has already seen never blinks out and back in.
 *
 * The state lives in a `data-revealed` attribute rather than a class: React
 * rewrites `className` when a component's classes change, and would wipe a
 * class added here; it leaves attributes it does not own alone.
 *
 * A MutationObserver picks up content that arrives later — a filtered
 * project list, search results — so it rises in like the rest.
 */
export default function MotionObserver() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    const seen = new WeakSet<Element>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', 'animate');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    function scan(): void {
      const ready = root.classList.contains('motion-ready');
      for (const element of document.querySelectorAll(TARGETS)) {
        if (seen.has(element)) continue;
        seen.add(element);
        if (element.hasAttribute('data-revealed')) continue;
        // Already visible before motion was switched on: leave it be.
        if (!ready && inView(element)) {
          element.setAttribute('data-revealed', 'static');
          continue;
        }
        io.observe(element);
      }
    }

    scan();
    root.classList.add('motion-ready');

    let frame = 0;
    const mo = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
      root.classList.remove('motion-ready');
    };
  }, []);

  return null;
}
