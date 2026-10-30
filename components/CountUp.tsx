'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 1400;

interface Props {
  /** The figure to land on. Rendered as-is on the server and without motion. */
  value: number;
}

/**
 * A figure that counts up from zero the first time it scrolls into view.
 *
 * The server renders the final figure, and so does a visitor who prefers
 * reduced motion, so the count is never the only way to read the number.
 * Assistive technology reads the final figure throughout; the ticking digits
 * are hidden from it.
 */
export default function CountUp({ value }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Already on screen at hydration: the visitor has read it, so leave it.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    setShown(0);
    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number): void => {
          const t = Math.min((now - start) / DURATION_MS, 1);
          // Ease-out cubic: the count slows into its final figure.
          setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(element);

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      setShown(value);
    };
  }, [value]);

  return (
    <>
      <span ref={ref} className="tabular-nums" aria-hidden="true">
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
