'use client';

import { useEffect, useRef, useState } from 'react';
import { media } from '../components/ui';

/**
 * The home hero's background: a muted, looping video over a still poster.
 *
 * Two cuts, because the hero fills the screen and a landscape frame cropped to
 * a phone loses everything but a sliver of its middle:
 *
 * - desktop, from the `sm` breakpoint up: 16:9, 1920×1080, ≤ 8 MB. The headline
 *   sits on the left under the darkest part of the scrim, so the action belongs
 *   in the right-hand 60% of the frame.
 * - mobile, below `sm`: 9:16, 720×1280, ≤ 3 MB. Under the phone scrim it reads
 *   as moving texture, so slow and simple beats detailed.
 *
 * Each cut is a WebM (VP9 or AV1) with an H.264 MP4 after it for Safari: a
 * 10–20 s seamless loop with no audio track. Each poster is that cut's first
 * frame at the same ratio. Until a file exists the poster simply stays: a
 * source that fails to load removes the video rather than leaving a blank.
 *
 * The poster is the server render and the LCP element. The video is only
 * mounted in the browser, once it is known that the visitor has not asked for
 * reduced motion or reduced data, so neither of them downloads a byte of it.
 * See docs/decisions.md §2.19.
 */

type Cut = 'desktop' | 'mobile';

const CUTS: Record<Cut, { poster: string; webm: string; mp4: string }> = {
  desktop: {
    poster: '/images/hero-aerial-estate.webp',
    webm: '/videos/hero-desktop.webm',
    mp4: '/videos/hero-desktop.mp4',
  },
  mobile: {
    poster: '/images/hero-aerial-estate.webp',
    webm: '/videos/hero-mobile.webm',
    mp4: '/videos/hero-mobile.mp4',
  },
};

/** Tailwind's `sm`, where the hero scrim also changes from even to left-weighted. */
const DESKTOP_QUERY = '(min-width: 40rem)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function saveDataOn(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return nav.connection?.saveData === true;
}

/** Subscribes to a media query; `null` until the first browser render. */
function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

export default function HeroVideo() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [saveData, setSaveData] = useState<boolean | null>(null);
  const [failed, setFailed] = useState<Cut[]>([]);
  const [playing, setPlaying] = useState(false);
  // Only ever set by the visitor: a pause they chose survives a breakpoint change.
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setSaveData(saveDataOn()), []);

  const cut: Cut | null = desktop === null ? null : desktop ? 'desktop' : 'mobile';
  const showVideo =
    cut !== null && reducedMotion === false && saveData === false && !failed.includes(cut);

  // `muted` has to be a property, set before play(), for autoplay to be
  // allowed. iOS Low Power Mode refuses autoplay regardless; the poster stays
  // and the control offers Play.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;
    video.muted = true;
    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => setPlaying(false));
    }
  }, [showVideo, cut, paused]);

  return (
    <>
      {CUTS.desktop.poster === CUTS.mobile.poster ? (
        <link rel="preload" as="image" href={CUTS.desktop.poster} fetchPriority="high" />
      ) : (
        <>
          <link
            rel="preload"
            as="image"
            href={CUTS.desktop.poster}
            media={DESKTOP_QUERY}
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            href={CUTS.mobile.poster}
            media={`not all and ${DESKTOP_QUERY}`}
            fetchPriority="high"
          />
        </>
      )}

      <div
        className="absolute inset-0 -z-2"
        role="img"
        aria-label="Footage of CoBuilt developments"
      >
        {/* Two layers, swapped by CSS, so the right poster shows before any script runs. */}
        <div
          className={`${media} absolute inset-0 sm:hidden`}
          style={{ backgroundImage: `url('${CUTS.mobile.poster}')` }}
          aria-hidden="true"
        />
        <div
          className={`${media} absolute inset-0 max-sm:hidden`}
          style={{ backgroundImage: `url('${CUTS.desktop.poster}')` }}
          aria-hidden="true"
        />

        {showVideo ? (
          <video
            // A new element per cut: changing <source> children does not reload a video.
            key={cut}
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
              playing ? 'opacity-100' : 'opacity-0'
            }`}
            poster={CUTS[cut].poster}
            autoPlay={!paused}
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <source src={CUTS[cut].webm} type="video/webm" />
            {/* The last source failing means none loaded: fall back to the poster for good. */}
            <source
              src={CUTS[cut].mp4}
              type="video/mp4"
              onError={() => {
                setPlaying(false);
                setFailed((current) => [...current, cut]);
              }}
            />
          </video>
        ) : null}
      </div>

      {/* WCAG 2.2.2: motion that runs longer than five seconds needs a way to stop it. */}
      {showVideo ? (
        <button
          type="button"
          className="absolute right-2 bottom-2 inline-flex min-h-target min-w-target cursor-pointer items-center justify-center text-white/75 hover:text-white sm:right-4 sm:bottom-4"
          aria-label={paused || !playing ? 'Play background video' : 'Pause background video'}
          onClick={() => {
            if (playing) {
              setPaused(true);
            } else {
              // Also covers refused autoplay, where `paused` is already false.
              setPaused(false);
              videoRef.current?.play().catch(() => setPlaying(false));
            }
          }}
        >
          {paused || !playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M3 1.5v11l9-5.5z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
              <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" />
            </svg>
          )}
        </button>
      ) : null}
    </>
  );
}
