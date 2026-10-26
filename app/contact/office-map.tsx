'use client';

import { useState } from 'react';
import { btnOutline } from '../../components/ui';

/**
 * The office on a map — OpenStreetMap, loaded only when asked for.
 *
 * An embedded map is a request to a third party the moment it renders, which
 * hands that party the visitor's IP address before they have chosen anything.
 * So the page shows a still panel and a button; the map frame, and the request
 * with it, only exists after the click. OpenStreetMap rather than Google Maps
 * because its embed sets no cookies, so it needs no cookie category. The
 * directions links open the visitor's own map app, in a new tab, which needs
 * no embed at all. See docs/decisions.md §2.17.
 */

interface OfficeMapProps {
  lat: number;
  lng: number;
  /** For the frame's title and the panel's accessible name. */
  label: string;
}

/** Roughly 1.3 km × 0.9 km around the marker: street level, with enough around it to orient by. */
const SPAN = { lng: 0.006, lat: 0.004 };

export default function OfficeMap({ lat, lng, label }: OfficeMapProps) {
  const [shown, setShown] = useState(false);

  const bbox = [lng - SPAN.lng, lat - SPAN.lat, lng + SPAN.lng, lat + SPAN.lat]
    .map((value) => value.toFixed(5))
    .join(',');
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-60 overflow-hidden border border-zinc-300 bg-zinc-100 sm:h-72">
        {shown ? (
          <iframe
            className="absolute inset-0 size-full border-0"
            src={embed}
            title={`Map: ${label}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            // Pan and zoom need scripts; nothing in a map needs our origin.
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : (
          <>
            {/* Site lines: a plan grid standing in for the map until it is asked for. */}
            <div
              className="absolute inset-0 opacity-70 [background-image:linear-gradient(var(--zinc-300)_1px,transparent_1px),linear-gradient(90deg,var(--zinc-300)_1px,transparent_1px)] [background-size:2rem_2rem]"
              aria-hidden="true"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="text-[1.5rem] leading-none text-orange" aria-hidden="true">
                ◈
              </span>
              <button type="button" className={btnOutline} onClick={() => setShown(true)}>
                Show the map
              </button>
              <p className="max-w-80 bg-zinc-100/90 px-2 text-[0.781rem] leading-[1.6] text-zinc-600">
                Loads from OpenStreetMap, which will see your IP address. No cookies are set.
              </p>
            </div>
          </>
        )}
      </div>

      <p className="flex flex-wrap gap-x-5 text-[0.844rem]">
        <a
          className="inline-flex min-h-target items-center text-rust underline hover:text-rust-hover"
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get directions<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a
          className="inline-flex min-h-target items-center text-rust underline hover:text-rust-hover"
          href={osm}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on OpenStreetMap<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
