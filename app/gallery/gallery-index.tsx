'use client';

import { useEffect, useState } from 'react';
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABEL, isGalleryCategory, type GalleryCategory } from '@/lib/gallery';
import type { GalleryAlbumSummary, GalleryFacets } from '@/lib/repositories/gallery';
import { btnOutline, container, eyebrow } from '../../components/ui';
import { FillImage, albumHref, photographCount } from './gallery-shared';

/**
 * The `/gallery` album grid and its two filters, category and project.
 *
 * Every published album arrives with the page, so filtering is instant and
 * needs no request. The filters are mirrored into the query string
 * (`?category=events&project=ocean-ridge`) with `replaceState`, so a filtered
 * view can be shared, and read back from it once the page is interactive. The
 * page is prerendered, so it cannot read the query string on the server; a
 * shared link therefore shows every album for the moment before it filters.
 *
 * Only filters with albums behind them are offered, as on `/projects`.
 */

const pill =
  'inline-flex min-h-target flex-none cursor-pointer items-center gap-2 border px-4.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em]';
const fieldLabel = 'text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-zinc-700';
/** 16px on a phone: below that, iOS Safari zooms the page when a field takes focus. */
const select =
  'select-chevron min-h-target w-full cursor-pointer rounded-none border border-zinc-500 bg-white pr-10 pl-3.5 text-base text-ink sm:w-72 sm:text-[0.875rem]';

/** Three across from `md`, two from `sm`; the first row is fetched eagerly. */
const CARD_SIZES = '(min-width: 901px) 360px, (min-width: 641px) 50vw, 100vw';

export default function GalleryIndex({
  albums,
  facets,
}: {
  albums: GalleryAlbumSummary[];
  facets: GalleryFacets;
}) {
  const [category, setCategory] = useState<GalleryCategory | ''>('');
  const [project, setProject] = useState('');

  // A shared link's filters, once the page is interactive. Values the page
  // does not offer are ignored rather than showing an empty grid.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get('category');
    if (isGalleryCategory(wanted)) setCategory(wanted);
    const wantedProject = params.get('project');
    if (wantedProject && facets.projects.some((item) => item.slug === wantedProject)) {
      setProject(wantedProject);
    }
  }, [facets.projects]);

  function apply(next: { category?: GalleryCategory | ''; project?: string }): void {
    const nextCategory = next.category ?? category;
    const nextProject = next.project ?? project;
    setCategory(nextCategory);
    setProject(nextProject);

    const params = new URLSearchParams();
    if (nextCategory) params.set('category', nextCategory);
    if (nextProject) params.set('project', nextProject);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `/gallery?${qs}` : '/gallery');
  }

  const counts = new Map(facets.categories.map((item) => [item.value, item.count]));
  const offered = GALLERY_CATEGORIES.filter((value) => counts.has(value) || value === category);

  const shown = albums.filter(
    (album) =>
      (!category || album.category === category) && (!project || album.project?.slug === project),
  );
  const projectName = facets.projects.find((item) => item.slug === project)?.title;
  const filtered = Boolean(category || project);

  return (
    <>
      {albums.length > 0 ? (
        <section className="border-b border-line bg-zinc-50 py-6 sm:py-7">
          <div className={`${container} flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8`}>
            {/* One scrolling row on a phone, bled to the screen edge, as on /projects. */}
            <div
              className="-mx-gutter flex w-[calc(100%+2*var(--spacing-gutter))] gap-2 overflow-x-auto px-gutter py-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:p-0 [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Filter albums by category"
            >
              {(['', ...offered] as const).map((value) => {
                const selected = category === value;
                const count = value ? (counts.get(value) ?? 0) : albums.length;
                return (
                  <button
                    key={value || 'all'}
                    type="button"
                    className={
                      selected
                        ? `${pill} border-ink bg-ink text-white`
                        : `${pill} border-zinc-500 bg-white text-ink hover:border-ink`
                    }
                    aria-pressed={selected}
                    onClick={() => apply({ category: value })}
                  >
                    {value ? GALLERY_CATEGORY_LABEL[value] : 'All'}
                    <span className={`font-mono text-[0.688rem] ${selected ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {facets.projects.length > 0 ? (
              <div className="flex flex-col gap-1.75">
                <label className={fieldLabel} htmlFor="gallery-project">
                  Project
                </label>
                <select
                  id="gallery-project"
                  className={select}
                  value={project}
                  onChange={(event) => apply({ project: event.target.value })}
                >
                  <option value="">All projects</option>
                  {facets.projects.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.title} ({item.count})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="bg-white py-11 sm:py-14 md:py-18">
        <div className={`${container} flex flex-col gap-7`}>
          {albums.length > 0 ? (
            <p className="text-[0.844rem] text-zinc-700" aria-live="polite">
              {shown.length === albums.length
                ? `${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`
                : `Showing ${shown.length} of ${albums.length} albums`}
              {category ? ` · ${GALLERY_CATEGORY_LABEL[category]}` : ''}
              {projectName ? ` · ${projectName}` : ''}
            </p>
          ) : null}

          {shown.length > 0 ? (
            <ul className="reveal grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {shown.map((album, index) => (
                <li key={album.id}>
                  <AlbumCard album={album} eager={index < 3} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 px-6 py-10 sm:px-10">
              <h2 className="text-[length:clamp(1.5rem,2.4vw,2.125rem)]">
                {filtered ? 'No albums match these filters.' : 'No albums have been published yet.'}
              </h2>
              <p className="max-w-130 text-[0.938rem] leading-[1.7] text-zinc-700">
                {filtered
                  ? 'Try another category or project, or see every album.'
                  : 'Photography appears here as albums are published.'}
              </p>
              {filtered ? (
                <button type="button" className={btnOutline} onClick={() => apply({ category: '', project: '' })}>
                  Show all albums
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/**
 * An album card: the whole card is one link, named by its text. The cover is
 * decorative here (`alt=""`) because the title already says what the album
 * is; each photograph is described where it is shown on its own.
 */
export function AlbumCard({ album, eager = false }: { album: GalleryAlbumSummary; eager?: boolean }) {
  return (
    <a className="group flex h-full flex-col border border-line bg-white" href={albumHref(album.slug)}>
      <div className="relative aspect-[4/3] overflow-hidden bg-line">
        {album.cover ? (
          <FillImage
            src={album.cover.url}
            alt=""
            sizes={CARD_SIZES}
            priority={eager}
            className="transition-transform duration-700 ease-settle group-hover:scale-104"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5.5 sm:p-6.5">
        <p className={eyebrow}>{GALLERY_CATEGORY_LABEL[album.category]}</p>
        <h2 className="text-[1.375rem] font-normal tracking-[-0.02em] text-ink group-hover:text-rust">
          {album.title}
        </h2>
        {album.description ? (
          <p className="line-clamp-2 text-[0.906rem] leading-[1.6] text-zinc-600">{album.description}</p>
        ) : null}
        <p className="mt-auto pt-1.5 font-mono text-[0.75rem] uppercase tracking-[0.08em] text-zinc-600">
          {photographCount(album.imageCount)}
          {album.project ? ` · ${album.project.title}` : ''}
        </p>
      </div>
    </a>
  );
}
