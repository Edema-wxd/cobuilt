'use client';

import { useEffect, useRef, useState } from 'react';
import { media } from '../components/ui';
import { youtubeEmbedUrl, youtubeWatchUrl } from '@/lib/youtube';

/**
 * The homepage's featured video — YouTube, loaded only when asked for.
 *
 * The same rule as the contact map (app/contact/office-map.tsx,
 * docs/decisions.md §2.17): an embed is a request to a third party the moment
 * it renders, so the page shows a house still and a play button, and neither
 * the player nor YouTube's thumbnail is requested until the visitor presses
 * it. The player then comes from youtube-nocookie.com, YouTube's
 * privacy-enhanced host, and starts at once — the press was the choice to play.
 *
 * The video is whichever one an administrator sets at /admin/homepage; the
 * page leaves the section out when none is set.
 */

const POSTER = '/images/villa-and-pool.webp';

export default function HomeVideo({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // The button that had focus is gone; hand focus to the player that replaced it.
  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  return (
    <figure className="flex flex-col gap-3">
      <div className="relative aspect-video w-full overflow-hidden bg-ink">
        {playing ? (
          <iframe
            ref={frame}
            className="absolute inset-0 size-full border-0"
            src={youtubeEmbedUrl(id)}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 size-full cursor-pointer text-left"
            onClick={() => setPlaying(true)}
          >
            <span
              className={`${media} absolute inset-0 transition-transform duration-700 ease-settle group-hover:scale-104`}
              style={{ backgroundImage: `url('${POSTER}')` }}
              aria-hidden="true"
            />
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className="flex size-16 items-center justify-center rounded-full border-[1.5px] border-white bg-[rgb(20_20_20/86%)] text-[1.125rem] text-white transition-colors duration-150 group-hover:bg-orange group-hover:text-ink group-focus-visible:bg-orange group-focus-visible:text-ink">
                ▶
              </span>
            </span>
            {/* Solid for the lower half so the title never lands on bright sky. */}
            <span className="absolute inset-x-0 bottom-0 flex flex-col bg-[linear-gradient(0deg,rgb(20_20_20/92%)_55%,rgb(20_20_20/0%))] px-4 pt-12 pb-4 text-white sm:px-5.5 sm:pt-14 sm:pb-5.5">
              <span className="text-[0.656rem] tracking-[0.18em] text-orange-on-dark uppercase">
                Play video
              </span>
              <span className="mt-1.5 text-[1.0625rem] font-normal sm:text-[1.25rem]">{title}</span>
            </span>
          </button>
        )}
      </div>

      <figcaption className="flex flex-col gap-1 text-[0.781rem] leading-[1.6] text-zinc-600 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <span>
          Plays from YouTube in privacy-enhanced mode, which sees your IP address once you press
          play. For captions, select CC in the player.
        </span>
        <a
          className="-my-2.5 inline-flex min-h-target flex-none items-center self-start whitespace-nowrap text-rust underline hover:text-rust-hover"
          href={youtubeWatchUrl(id)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Watch on YouTube<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  );
}
