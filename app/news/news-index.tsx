'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  sectionHead,
  titleMd,
} from '../../components/sections';
import {
  btnOrange,
  btnOutline,
  btnOutlineOnDark,
  btnWhite,
  container,
  eyebrow,
  media,
} from '../../components/ui';

/**
 * Media centre — `/news`.
 *
 * The nav's Media item and the landing page's "More news" button both pointed
 * at the newsletter form. This is the page they meant.
 *
 * Like the projects index, the list is read from the API in the browser rather
 * than on the server: `/api/news` needs PostgreSQL, and a checkout without a
 * database should still render the page and say plainly that the list could not
 * be loaded (docs/decisions.md §2.9). Filters live in the query string, so a
 * filtered view is shareable and the back button works.
 *
 * `/news/category/[category]` from the handover is not a separate route: the
 * category is a filter on this page (`/news?category=update`), which keeps one
 * list implementation and one empty state. The API route of that name still
 * exists for clients that want it.
 */

const PAGE_SIZE = 9;

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  tags: string[];
  author: string | null;
  featuredImageUrl: string | null;
  publishedAt: string | null;
}

interface ArticlePage {
  results: Article[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface Facet {
  value: string;
  count: number;
}

const IMAGES = {
  apartments: '/images/apartment-blocks.webp',
} as const;

const pill =
  'inline-flex min-h-target flex-none cursor-pointer items-center gap-2 border px-4.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em]';
const pillOn = `${pill} border-ink bg-ink text-white`;
const pillOff = `${pill} border-zinc-500 bg-white text-ink hover:border-ink`;
const fieldLabel = 'text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-zinc-700';
/** 16px on a phone: below that, iOS Safari zooms the page when a field takes focus. */
const control =
  'min-h-11.5 w-full rounded-none border border-zinc-500 bg-white px-3.5 text-base text-ink sm:text-[0.875rem]';

/** `press_release` reads as a database value; this is the same thing in English. */
function categoryLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

/** "02 Sep 2026", the form the landing page's news cards use. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toPage(value: string): number {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** The photo eases in a little under the pointer; its frame clips the overflow. */
const cardImage =
  'aspect-[16/10] transition-transform duration-700 ease-settle group-hover:scale-104 sm:aspect-auto sm:h-50';

/** Placeholder cards while the page loads, with a light sweeping across them. */
function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-6 md:grid-cols-3" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="flex flex-col gap-3.5">
          <div className="shimmer aspect-[16/10] sm:aspect-auto sm:h-50" />
          <div className="shimmer h-2.5 w-2/5" />
          <div className="shimmer h-4.5 w-11/12" />
          <div className="shimmer h-2.5 w-4/5 opacity-50" />
        </div>
      ))}
    </div>
  );
}

export default function NewsIndex() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Depended on rather than the params object itself: a stable string is a
  // sound effect dependency, where the object identity is not guaranteed.
  const queryString = searchParams?.toString() ?? '';

  const param = useCallback((key: string) => searchParams?.get(key) ?? '', [searchParams]);

  const category = param('category');
  const tag = param('tag');
  const q = param('q');
  const page = toPage(param('page'));

  const [categories, setCategories] = useState<Facet[]>([]);
  const [data, setData] = useState<ArticlePage | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [draftQ, setDraftQ] = useState('');

  // The URL is the single source of truth for filters; the text field keeps a
  // local draft only so typing is not one router push per keystroke.
  useEffect(() => {
    setDraftQ(q);
  }, [q]);

  const setQuery = useCallback(
    (changes: Record<string, string>) => {
      const merged: Record<string, string> = {};
      for (const [key, value] of searchParams?.entries() ?? []) merged[key] = value;
      Object.assign(merged, changes);

      const next = new URLSearchParams();
      for (const [key, value] of Object.entries(merged)) {
        // A cleared filter leaves the URL rather than sitting in it as an empty
        // parameter, and any filter change returns to the first page.
        if (value && !(key === 'page' && value === '1')) next.set(key, value);
      }

      const qs = next.toString();
      router.push(qs ? `/news?${qs}` : '/news', { scroll: false });
    },
    [router, searchParams],
  );

  // Debounced, so a search is one request after typing stops rather than one
  // per character. Submitting the form applies it immediately.
  useEffect(() => {
    if (draftQ === q) return;
    const timer = setTimeout(() => setQuery({ q: draftQ, page: '1' }), 400);
    return () => clearTimeout(timer);
  }, [draftQ, q, setQuery]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/search/facets?type=news', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { categories?: Facet[] } | null) => {
        if (payload?.categories) setCategories(payload.categories);
      })
      .catch(() => {
        // The category pills fall back to "All"; the list still loads.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    for (const key of ['category', 'tag', 'q'] as const) {
      const value = param(key);
      if (value) params.set(key, value);
    }

    fetch(`/api/news?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as ArticlePage;
      })
      .then((payload) => {
        setData(payload);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState('error');
      });

    return () => controller.abort();
    // `queryString` stands in for every filter `param` reads above: it changes
    // whenever any of them does, and is a stable string rather than an object.
  }, [queryString, page, attempt]);

  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);
  const filtered = Boolean(category || tag || q);

  return (
    <SiteLayout current="/news">
      <main>
        <PageHero
          eyebrow="Media centre"
          title={
            <>
              Company updates, project news and <em>thinking</em>.
            </>
          }
          standfirst="Press releases, project updates and announcements in one place. Project progress itself is recorded in each development’s Project Passport™."
          actions={
            <>
              <a className={btnWhite} href="/#register">
                Get updates by email
              </a>
              <a className={btnOutlineOnDark} href="/contact">
                Media enquiries
              </a>
            </>
          }
        />

        {/* The filter bar: a category row that scrolls on a phone, and free text. */}
        <section className="border-b border-line bg-zinc-100 py-6 sm:py-7">
          <div className={`${container} flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-8`}>
            <div
              className="-mx-gutter flex w-[calc(100%+2*var(--spacing-gutter))] gap-2 overflow-x-auto px-gutter py-1 [scrollbar-width:none] lg:mx-0 lg:w-auto lg:flex-1 lg:flex-wrap lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Filter articles by category"
            >
              <button
                type="button"
                className={category === '' ? pillOn : pillOff}
                aria-pressed={category === ''}
                onClick={() => setQuery({ category: '', page: '1' })}
              >
                All
              </button>
              {categories.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={category === option.value ? pillOn : pillOff}
                  aria-pressed={category === option.value}
                  onClick={() => setQuery({ category: option.value, page: '1' })}
                >
                  {categoryLabel(option.value)}
                  <span
                    className={`font-normal ${category === option.value ? 'text-zinc-200' : 'text-zinc-600'}`}
                  >
                    {option.count}
                  </span>
                </button>
              ))}
            </div>

            <form
              className="flex flex-col gap-1.75 lg:w-80"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery({ q: draftQ, page: '1' });
              }}
            >
              <label className={fieldLabel} htmlFor="news-q">
                Search the media centre
              </label>
              <input
                id="news-q"
                className={`${control} placeholder:text-zinc-500`}
                type="search"
                name="q"
                placeholder="Title or keyword"
                value={draftQ}
                onChange={(event) => setDraftQ(event.target.value)}
              />
            </form>
          </div>
        </section>

        <section className="bg-white py-11 sm:py-14 md:py-18">
          <div className={container}>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4 sm:mb-9">
              <p className="text-[0.844rem] text-zinc-700" role="status">
                {state === 'loading'
                  ? 'Loading articles…'
                  : state === 'error'
                    ? 'Articles unavailable'
                    : total === 0
                      ? 'No articles'
                      : `Showing ${firstRow}–${lastRow} of ${total} article${total === 1 ? '' : 's'}`}
              </p>
              {filtered ? (
                <button
                  type="button"
                  className="inline-flex min-h-target cursor-pointer items-center text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover"
                  onClick={() => {
                    setDraftQ('');
                    router.push('/news', { scroll: false });
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            {state === 'loading' ? <Skeleton /> : null}

            {state === 'error' ? (
              <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                <p className={eyebrow}>Not loaded</p>
                <h2 className={titleMd}>The article list couldn&rsquo;t be loaded</h2>
                <p className={`${bodyCopy} max-w-150`}>
                  This is on our side, not yours. Try again in a moment — and if it keeps happening,
                  tell us, because that is exactly the kind of thing we would want reported.
                </p>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  <button
                    type="button"
                    className={btnOrange}
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Try again
                  </button>
                  <a
                    className={btnOutline}
                    href="/contact"
                  >
                    Report it
                  </a>
                </div>
              </div>
            ) : null}

            {state === 'ready' && total === 0 ? (
              <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                <p className={eyebrow}>Nothing here</p>
                <h2 className={titleMd}>
                  {filtered ? 'No articles match these filters' : 'No articles published yet'}
                </h2>
                <p className={`${bodyCopy} max-w-150`}>
                  {filtered
                    ? 'Try a broader category, or clear the filters to see everything published.'
                    : 'Company news and project updates will appear here as they are published. Project progress is recorded continuously in each development’s Project Passport™.'}
                </p>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  {filtered ? (
                    <button
                      type="button"
                      className={btnOrange}
                      onClick={() => {
                        setDraftQ('');
                        router.push('/news', { scroll: false });
                      }}
                    >
                      Clear filters
                    </button>
                  ) : null}
                  <a
                    className={btnOutline}
                    href="/projects"
                  >
                    Browse the projects
                  </a>
                </div>
              </div>
            ) : null}

            {state === 'ready' && total > 0 ? (
              <div className="reveal-stagger grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
                {data?.results.map((article) => (
                  <article key={article.id} className="flex flex-col gap-3.5">
                    <a className="group flex flex-col gap-3.5" href={`/news/${article.slug}`}>
                      <div className="overflow-hidden">
                        {article.featuredImageUrl ? (
                          <div
                            className={`${media} ${cardImage}`}
                            style={{ backgroundImage: `url('${article.featuredImageUrl}')` }}
                            role="img"
                            aria-label={article.title}
                          />
                        ) : (
                          // A missing featured image is ordinary CMS data, so the
                          // card degrades to the house still rather than a gap.
                          <div
                            className={`${media} ${cardImage}`}
                            style={{ backgroundImage: `url('${IMAGES.apartments}')` }}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.688rem] tracking-[0.16em] text-zinc-500 uppercase">
                        {article.category ? (
                          <span className="text-rust">{categoryLabel(article.category)}</span>
                        ) : null}
                        <span>{formatDate(article.publishedAt)}</span>
                      </p>
                      <h2 className="text-[1.1875rem] leading-[1.35] font-normal tracking-normal text-ink group-hover:text-rust">
                        {article.title}
                      </h2>
                    </a>
                    {article.excerpt ? (
                      <p className="text-[0.875rem] leading-[1.65] text-zinc-600">
                        {article.excerpt}
                      </p>
                    ) : null}
                    <a
                      className="mt-auto inline-flex min-h-target items-center self-start text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover"
                      href={`/news/${article.slug}`}
                    >
                      Read the article →
                    </a>
                  </article>
                ))}
              </div>
            ) : null}

            {state === 'ready' && totalPages > 1 ? (
              <nav
                className="mt-9 flex items-center justify-between gap-4 border-t border-line pt-6 sm:mt-12"
                aria-label="Pagination"
              >
                {page > 1 ? (
                  <a
                    className="inline-flex min-h-12 items-center justify-center border border-zinc-500 bg-white px-6 text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-ink hover:border-ink"
                    href={`/news?${new URLSearchParams({
                      ...Object.fromEntries(searchParams?.entries() ?? []),
                      page: String(page - 1),
                    }).toString()}`}
                  >
                    ← Newer
                  </a>
                ) : (
                  <span />
                )}
                <p className="font-mono text-[0.781rem] tracking-[0.1em] text-zinc-700">
                  Page {page} of {totalPages}
                </p>
                {page < totalPages ? (
                  <a
                    className="inline-flex min-h-12 items-center justify-center border border-zinc-500 bg-white px-6 text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-ink hover:border-ink"
                    href={`/news?${new URLSearchParams({
                      ...Object.fromEntries(searchParams?.entries() ?? []),
                      page: String(page + 1),
                    }).toString()}`}
                  >
                    Older →
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </div>
        </section>

        <section className="border-t border-line bg-zinc-100 py-11 sm:py-14">
          <div
            className={`${container} flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8`}
          >
            <div className={`${sectionHead} max-w-150`}>
              <p className={eyebrow}>Press desk</p>
              <h2 className={cardTitle}>For journalists and media</h2>
              <p className={cardBody}>
                Interview requests, project imagery and footage: the contact page routes media
                enquiries straight to the press desk.
              </p>
            </div>
            <a
              className={`${btnOutline} w-full sm:w-auto`}
              href="/contact"
            >
              Media enquiries
            </a>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
