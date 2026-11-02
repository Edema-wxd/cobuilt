'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { GalleryImage } from '@/lib/repositories/gallery';
import { FillImage } from '../gallery-shared';

/**
 * An album's photographs: a grid of tiles, and the full-screen viewer they open.
 *
 * Each tile is a link to the image file itself, so without JavaScript a
 * photograph still opens full size; with it, the link opens the viewer instead.
 *
 * The viewer is a modal dialog (WCAG 2.2): focus moves to its close button and
 * is held inside it, Escape closes it and focus returns to the tile that
 * opened it, the arrow keys (and Home and End) move between photographs, and a
 * horizontal swipe does the same on a touch screen. Every control is 44px or
 * larger and visible, and each photograph carries its alt text, with its
 * caption and date beneath. Moving between photographs is announced.
 *
 * Performance: tiles are fixed 4:3 frames, so nothing moves as images arrive;
 * `next/image` serves each at the width its slot needs and loads those below
 * the fold lazily. The viewer asks for a larger copy at higher quality, and
 * fetches the photographs either side so moving on is instant.
 */

const TILE_SIZES = '(min-width: 901px) 280px, (min-width: 641px) 33vw, 50vw';
const FULL_SIZES = '100vw';

/** How far a finger must travel sideways, in px, to count as a swipe. */
const SWIPE_DISTANCE = 50;

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function formatTaken(date: string): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

const control =
  'inline-flex size-12 flex-none cursor-pointer items-center justify-center border border-white/50 bg-ink-deep/80 text-[1.25rem] text-white transition-colors duration-150 hover:border-white hover:bg-ink-deep';

export default function AlbumViewer({ title, images }: { title: string; images: GalleryImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const tileRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const close = useCallback(() => {
    // Back to the tile of the photograph the viewer was showing, so keyboard
    // users carry on from where they got to.
    const tile = open === null ? null : tileRefs.current[open];
    setOpen(null);
    if (tile) requestAnimationFrame(() => tile.focus());
  }, [open]);

  return (
    <>
      <ul className="reveal grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
        {images.map((image, index) => (
          <li key={image.id}>
            <figure className="flex flex-col gap-2">
              <a
                ref={(element) => {
                  tileRefs.current[index] = element;
                }}
                className="group relative block aspect-[4/3] overflow-hidden bg-line"
                href={image.url}
                aria-haspopup="dialog"
                onClick={(event) => {
                  // Modified clicks keep their usual meaning (open the file in a new tab).
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  setOpen(index);
                }}
              >
                <FillImage
                  src={image.url}
                  alt={image.alt}
                  sizes={TILE_SIZES}
                  // The first row is likely in view on arrival; the rest load as they near it.
                  priority={index < 4}
                  className="transition-transform duration-700 ease-settle group-hover:scale-104"
                />
              </a>
              {image.caption ? (
                <figcaption className="line-clamp-2 text-[0.813rem] leading-[1.5] text-zinc-700">
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>

      {open !== null ? (
        <Lightbox title={title} images={images} index={open} onIndex={setOpen} onClose={close} />
      ) : null}
    </>
  );
}

function Lightbox({
  title,
  images,
  index,
  onIndex,
  onClose,
}: {
  title: string;
  images: GalleryImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const headingId = useId();
  const captionId = useId();

  const count = images.length;
  const image = images[index]!;
  // Wraps at either end, so the arrows never dead-end.
  const go = useCallback((by: number) => onIndex((index + by + count) % count), [index, count, onIndex]);

  // Focus moves in, and the page behind stops scrolling, while the viewer is open.
  useEffect(() => {
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        return;
      case 'ArrowRight':
        event.preventDefault();
        go(1);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        go(-1);
        return;
      case 'Home':
        event.preventDefault();
        onIndex(0);
        return;
      case 'End':
        event.preventDefault();
        onIndex(count - 1);
        return;
      case 'Tab': {
        // Holds focus inside the dialog: Tab from the last control returns to
        // the first, and Shift+Tab from the first goes to the last.
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [],
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
    }
  }

  const neighbours = count > 1 ? [...new Set([(index + 1) % count, (index - 1 + count) % count])] : [];

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-60 flex flex-col bg-ink-deep text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={image.caption || image.takenOn ? captionId : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line-on-dark px-gutter py-2.5">
        <h2 id={headingId} className="min-w-0 truncate text-[0.719rem] font-semibold uppercase tracking-[0.16em] text-zinc-200">
          {title}
          <span className="sr-only"> — photo viewer</span>
        </h2>
        <div className="flex items-center gap-4">
          <p className="font-mono text-[0.781rem] whitespace-nowrap text-zinc-200" aria-hidden="true">
            {index + 1} / {count}
          </p>
          <button ref={closeRef} type="button" className={control} onClick={onClose}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close the viewer</span>
          </button>
        </div>
      </div>

      {/* Announces each move: the position and what the photograph shows. */}
      <p className="sr-only" aria-live="polite">
        Photograph {index + 1} of {count}: {image.alt}
      </p>

      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !touch || count < 2) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        }}
      >
        <div className="absolute inset-3 sm:inset-6 md:inset-x-20">
          {/* Keyed so a slow image never shows under the next one's alt text. */}
          <FillImage key={image.id} src={image.url} alt={image.alt} sizes={FULL_SIZES} quality={85} fit="contain" priority />
        </div>

        {/* The photographs either side, fetched now so moving on is instant. */}
        <div className="pointer-events-none invisible absolute size-px overflow-hidden" aria-hidden="true">
          {neighbours.map((n) => (
            <div key={images[n]!.id} className="relative size-px">
              <FillImage src={images[n]!.url} alt="" sizes={FULL_SIZES} quality={85} fit="contain" priority />
            </div>
          ))}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              className={`${control} absolute top-1/2 left-2 -translate-y-1/2 sm:left-4`}
              onClick={() => go(-1)}
            >
              <span aria-hidden="true">←</span>
              <span className="sr-only">Previous photograph</span>
            </button>
            <button
              type="button"
              className={`${control} absolute top-1/2 right-2 -translate-y-1/2 sm:right-4`}
              onClick={() => go(1)}
            >
              <span aria-hidden="true">→</span>
              <span className="sr-only">Next photograph</span>
            </button>
          </>
        ) : null}
      </div>

      <div className="min-h-16 border-t border-line-on-dark px-gutter py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <div id={captionId} className="mx-auto flex max-w-measure flex-col gap-1">
          {image.caption ? <p className="text-[0.938rem] leading-[1.6] text-white">{image.caption}</p> : null}
          {image.takenOn ? (
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.1em] text-zinc-400">
              Taken {formatTaken(image.takenOn)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
