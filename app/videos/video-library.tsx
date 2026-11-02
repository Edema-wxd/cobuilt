'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PublicVideo } from '@/lib/repositories/videos';
import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABEL,
  VIDEO_CATEGORY_PLURAL,
  isVideoCategory,
  type VideoCategory,
} from '@/lib/videos';
import { cardBody, sectionHead, titleMd } from '../../components/sections';
import { container, eyebrow } from '../../components/ui';
import HomeVideo from '../home-video';
import VideoCard from './video-card';
import { formatMonth, posterFor, searchText, videoHref } from './video-shared';

/**
 * The library's body: the featured film, then the filters and the grid.
 *
 * The page hands over every published film (`./page.tsx` says why), and the
 * filters narrow it here. They mirror the query string — `?category=drone`,
 * `?project=ocean-ridge-residences`, `?q=handover` — read once on arrival and
 * replaced as they change, so a filtered view can be shared and reloaded. The
 * query string is read after mount rather than through `useSearchParams`,
 * which would take the page out of its one-minute prerender.
 */

const pill =
  'inline-flex min-h-target flex-none cursor-pointer items-center gap-2 border px-4.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em]';
const pillOn = `${pill} border-ink bg-ink text-white`;
const pillOff = `${pill} border-zinc-500 bg-white text-ink hover:border-ink`;
const fieldLabel = 'text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-zinc-700';
/** 16px on a phone: below that, iOS Safari zooms the page when a field takes focus. */
const control =
  'min-h-11.5 w-full rounded-none border border-zinc-500 bg-white px-3.5 text-base text-ink sm:text-[0.875rem]';

interface Filters {
  category: VideoCategory | '';
  project: string;
  q: string;
}

const NONE: Filters = { category: '', project: '', q: '' };

function filtersFromUrl(): Filters {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category') ?? '';
  return {
    category: isVideoCategory(category) ? category : '',
    project: params.get('project') ?? '',
    q: params.get('q') ?? '',
  };
}

function writeUrl(filters: Filters): void {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.project) params.set('project', filters.project);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  const qs = params.toString();
  window.history.replaceState(window.history.state, '', qs ? `/videos?${qs}` : '/videos');
}

export default function VideoLibrary({ videos }: { videos: PublicVideo[] }) {
  const [filters, setFilters] = useState<Filters>(NONE);

  function update(changes: Partial<Filters>): void {
    const next = { ...filters, ...changes };
    setFilters(next);
    writeUrl(next);
  }

  // The first film marked featured leads the page; the first in order otherwise.
  const featured = videos.find((video) => video.featured) ?? videos[0]!;

  const categories = useMemo(
    () =>
      VIDEO_CATEGORIES.map((value) => ({
        value,
        count: videos.filter((video) => video.category === value).length,
      })).filter((option) => option.count > 0),
    [videos],
  );

  const projects = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const video of videos) {
      if (video.project) bySlug.set(video.project.slug, video.project.title);
    }
    return [...bySlug].map(([slug, title]) => ({ slug, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [videos]);

  useEffect(() => {
    const fromUrl = filtersFromUrl();
    // A project with no published films left (or a mistyped link) is dropped
    // rather than shown as an empty result under "All projects".
    if (!projects.some((project) => project.slug === fromUrl.project)) fromUrl.project = '';
    setFilters(fromUrl);
    // Once, on arrival: afterwards the filters write the URL, not the other way round.
  }, []);

  const filtered = Boolean(filters.category || filters.project || filters.q.trim());
  const words = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const shown = videos.filter((video) => {
    // Unfiltered, the featured film is already at the top of the page.
    if (!filtered) return video.id !== featured.id;
    if (filters.category && video.category !== filters.category) return false;
    if (filters.project && video.project?.slug !== filters.project) return false;
    const text = searchText(video);
    return words.every((word) => text.includes(word));
  });

  const featuredMonth = formatMonth(featured.recordedOn);

  return (
    <>
      <section className="bg-white py-11 sm:py-14 md:py-18" aria-labelledby="featured-title">
        <div
          className={`${container} grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-11`}
        >
          <div className="reveal">
            <HomeVideo id={featured.youtubeId} title={featured.title} poster={posterFor(featured)} />
          </div>
          <div className={sectionHead}>
            <p className={eyebrow}>
              {featured.featured ? 'Featured' : 'Latest'} · {VIDEO_CATEGORY_LABEL[featured.category]}
            </p>
            <h2 className={titleMd} id="featured-title">
              <a className="text-ink hover:text-rust" href={videoHref(featured.slug)}>
                {featured.title}
              </a>
            </h2>
            {featuredMonth ? (
              <p className="font-mono text-[0.781rem] tracking-[0.08em] text-zinc-600 uppercase">
                {featuredMonth}
              </p>
            ) : null}
            {featured.description ? (
              <p className={`${cardBody} line-clamp-5`}>{featured.description}</p>
            ) : null}
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
              <a
                className="inline-flex min-h-target items-center text-[0.719rem] font-semibold tracking-[0.14em] text-rust uppercase hover:text-rust-hover"
                href={videoHref(featured.slug)}
              >
                <span className="sr-only">{featured.title} — </span>About this film →
              </a>
              {featured.project ? (
                <a
                  className="inline-flex min-h-target items-center text-[0.719rem] font-semibold tracking-[0.14em] text-rust uppercase hover:text-rust-hover"
                  href={`/projects/${featured.project.slug}`}
                >
                  <span className="sr-only">Project: </span>
                  {featured.project.title} →
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {videos.length > 1 ? (
        <>
          {/* The filter bar: a category row that scrolls on a phone, a project picker and free text. */}
          <section className="border-y border-line bg-zinc-100 py-6 sm:py-7" aria-label="Filter the library">
            <div className={`${container} flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-8`}>
              <div
                className="-mx-gutter flex w-[calc(100%+2*var(--spacing-gutter))] gap-2 overflow-x-auto px-gutter py-1 [scrollbar-width:none] lg:mx-0 lg:w-auto lg:flex-1 lg:flex-wrap lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Filter videos by category"
              >
                <button
                  type="button"
                  className={filters.category === '' ? pillOn : pillOff}
                  aria-pressed={filters.category === ''}
                  onClick={() => update({ category: '' })}
                >
                  All
                </button>
                {categories.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={filters.category === option.value ? pillOn : pillOff}
                    aria-pressed={filters.category === option.value}
                    onClick={() => update({ category: option.value })}
                  >
                    {VIDEO_CATEGORY_PLURAL[option.value]}
                    <span
                      className={`font-normal ${filters.category === option.value ? 'text-zinc-200' : 'text-zinc-600'}`}
                    >
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-[34rem] lg:flex-none">
                {projects.length > 0 ? (
                  <div className="flex flex-col gap-1.75">
                    <label className={fieldLabel} htmlFor="videos-project">
                      Project
                    </label>
                    <select
                      id="videos-project"
                      className={`${control} select-chevron cursor-pointer pr-10`}
                      value={filters.project}
                      onChange={(event) => update({ project: event.target.value })}
                    >
                      <option value="">All projects</option>
                      {projects.map((project) => (
                        <option key={project.slug} value={project.slug}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <form
                  className={`flex flex-col gap-1.75 ${projects.length > 0 ? '' : 'sm:col-span-2'}`}
                  role="search"
                  onSubmit={(event) => event.preventDefault()}
                >
                  <label className={fieldLabel} htmlFor="videos-q">
                    Search the library
                  </label>
                  <input
                    id="videos-q"
                    className={`${control} placeholder:text-zinc-500`}
                    type="search"
                    name="q"
                    placeholder="Title, topic or project"
                    maxLength={200}
                    value={filters.q}
                    onChange={(event) => update({ q: event.target.value })}
                  />
                </form>
              </div>
            </div>
          </section>

          <section className="bg-white py-11 sm:py-14 md:py-18" aria-labelledby="library-title">
            <div className={container}>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
                <div className="flex flex-col gap-2">
                  <h2 className="text-[0.781rem] font-semibold tracking-[0.16em] text-ink uppercase" id="library-title">
                    {filtered ? 'Matching films' : 'More from the library'}
                  </h2>
                  <p className="text-[0.844rem] text-zinc-700" role="status">
                    {filtered
                      ? `${shown.length} of ${videos.length} ${videos.length === 1 ? 'film' : 'films'} match`
                      : `${videos.length} films in the library`}
                  </p>
                </div>
                {filtered ? (
                  <button
                    type="button"
                    className="inline-flex min-h-target cursor-pointer items-center text-[0.688rem] font-semibold tracking-[0.14em] text-rust uppercase hover:text-rust-hover"
                    onClick={() => update(NONE)}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              {shown.length > 0 ? (
                <div className="reveal-stagger grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((video) => (
                    <VideoCard key={video.id} video={video} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                  <p className={eyebrow}>No matches</p>
                  <p className="text-[0.938rem] leading-[1.7] text-zinc-700">
                    No film matches those filters. Try another category or project, or fewer words.
                  </p>
                  <button
                    type="button"
                    className="inline-flex min-h-target cursor-pointer items-center text-[0.688rem] font-semibold tracking-[0.14em] text-rust uppercase hover:text-rust-hover"
                    onClick={() => update(NONE)}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
