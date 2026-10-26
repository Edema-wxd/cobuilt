'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import { bodyCopy, titleMd } from '../../components/sections';
import { btnOrange, btnOutline, container, eyebrow } from '../../components/ui';
import SearchBox from './search-box';

/**
 * Site search — `/search`.
 *
 * Results span projects, news and FAQs. The type is a filter in the query
 * string, so a search is shareable and the back button works. The field
 * suggests titles as you type (`search-box.tsx`). The API also
 * reports which engine answered; that is diagnostic and deliberately not shown.
 */

const PAGE_SIZE = 10;

type HitType = 'project' | 'news' | 'faq';

interface Hit {
  id: string;
  type: HitType;
  title: string;
  excerpt: string | null;
  url: string;
  publishedAt: string | null;
}

interface SearchPage {
  results: Hit[];
  total: number;
  page: number;
  pageSize: number;
}

const TYPES: { value: '' | HitType; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'project', label: 'Projects' },
  { value: 'news', label: 'Media' },
  { value: 'faq', label: 'FAQs' },
];

const TYPE_LABEL: Record<HitType, string> = { project: 'Project', news: 'Media', faq: 'FAQ' };

const pill =
  'inline-flex min-h-target flex-none cursor-pointer items-center border px-4.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em]';
const pillOn = `${pill} border-ink bg-ink text-white`;
const pillOff = `${pill} border-zinc-500 bg-white text-ink hover:border-ink`;
const pageLink =
  'inline-flex min-h-12 items-center justify-center border border-zinc-500 bg-white px-6 text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-ink hover:border-ink';
/** 16px on a phone: below that, iOS Safari zooms the page when a field takes focus. */
const control =
  'min-h-12 w-full rounded-none border border-zinc-500 bg-white px-3.5 text-base text-ink placeholder:text-zinc-500 sm:text-[0.9375rem]';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toPage(value: string): number {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function isType(value: string): value is HitType {
  return value === 'project' || value === 'news' || value === 'faq';
}

export default function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() ?? '';

  const q = (searchParams?.get('q') ?? '').trim();
  const rawType = searchParams?.get('type') ?? '';
  const type = isType(rawType) ? rawType : '';
  const page = toPage(searchParams?.get('page') ?? '');

  const [draft, setDraft] = useState(q);
  const [data, setData] = useState<SearchPage | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  const go = useCallback(
    (changes: { q?: string; type?: string; page?: number }) => {
      const next = new URLSearchParams();
      const nextQ = changes.q ?? q;
      const nextType = changes.type ?? type;
      const nextPage = changes.page ?? 1;
      if (nextQ) next.set('q', nextQ);
      if (nextType) next.set('type', nextType);
      if (nextPage > 1) next.set('page', String(nextPage));
      const qs = next.toString();
      router.push(qs ? `/search?${qs}` : '/search', { scroll: false });
    },
    [q, type, router],
  );

  useEffect(() => {
    if (!q) {
      setData(null);
      setState('idle');
      return;
    }

    const controller = new AbortController();
    setState('loading');

    const params = new URLSearchParams({ q, page: String(page), pageSize: String(PAGE_SIZE) });
    if (type) params.set('type', type);

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as SearchPage;
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
    // `queryString` stands in for q, type and page, which are derived from it.
  }, [queryString, attempt]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  const pageHref = (target: number) => {
    const params = new URLSearchParams({ q });
    if (type) params.set('type', type);
    if (target > 1) params.set('page', String(target));
    return `/search?${params.toString()}`;
  };

  return (
    <SiteLayout>
      <main>
        <PageHero
          eyebrow="Search"
          title={
            <>
              Find a project, an update or <em>an answer</em>.
            </>
          }
          standfirst="Search across our developments, the media centre and the questions we are asked most."
        />

        <section className="border-b border-line bg-zinc-100 py-6 sm:py-7">
          <div className={`${container} flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-8`}>
            <form
              className="flex flex-col gap-2 sm:flex-row lg:w-130"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                go({ q: draft.trim() });
              }}
            >
              <label className="sr-only" htmlFor="site-q">
                Search the site
              </label>
              <SearchBox id="site-q" className={control} value={draft} onChange={setDraft} />
              <button type="submit" className={`${btnOrange} sm:flex-none`}>
                Search
              </button>
            </form>

            <div
              className="flex flex-wrap gap-2 lg:flex-1 lg:justify-end"
              role="group"
              aria-label="Filter results by type"
            >
              {TYPES.map((option) => (
                <button
                  key={option.value || 'all'}
                  type="button"
                  className={type === option.value ? pillOn : pillOff}
                  aria-pressed={type === option.value}
                  onClick={() => go({ type: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-11 sm:py-14 md:py-18">
          <div className={container}>
            <p className="mb-7 text-[0.844rem] text-zinc-700 sm:mb-9" role="status">
              {state === 'idle'
                ? 'Enter a search term'
                : state === 'loading'
                  ? 'Searching…'
                  : state === 'error'
                    ? 'Search unavailable'
                    : total === 0
                      ? `No results for “${q}”`
                      : `Showing ${firstRow}–${lastRow} of ${total} result${total === 1 ? '' : 's'} for “${q}”`}
            </p>

            {state === 'idle' ? (
              <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                <p className={eyebrow}>Start here</p>
                <h2 className={titleMd}>What are you looking for?</h2>
                <p className={`${bodyCopy} max-w-150`}>
                  Try a project name, a location or a topic. Or browse the projects directly.
                </p>
                <a className={btnOutline} href="/projects">
                  Browse the projects
                </a>
              </div>
            ) : null}

            {state === 'loading' ? (
              <ul className="flex flex-col gap-px border border-line bg-line" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <li key={index} className="flex flex-col gap-3 bg-white p-5.5">
                    <div className="h-2.5 w-1/5 bg-line" />
                    <div className="h-4.5 w-3/5 bg-line" />
                    <div className="h-2.5 w-4/5 bg-zinc-100" />
                  </li>
                ))}
              </ul>
            ) : null}

            {state === 'error' ? (
              <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                <p className={eyebrow}>Not loaded</p>
                <h2 className={titleMd}>Search couldn&rsquo;t be completed</h2>
                <p className={`${bodyCopy} max-w-150`}>
                  This is on our side, not yours. Try again in a moment, or browse the projects
                  directly.
                </p>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  <button
                    type="button"
                    className={btnOrange}
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Try again
                  </button>
                  <a className={btnOutline} href="/projects">
                    Browse the projects
                  </a>
                </div>
              </div>
            ) : null}

            {state === 'ready' && total === 0 ? (
              <div className="flex flex-col items-start gap-4 border border-line bg-zinc-50 p-7 sm:p-10">
                <p className={eyebrow}>Nothing here</p>
                <h2 className={titleMd}>No results match that search</h2>
                <p className={`${bodyCopy} max-w-150`}>
                  Check the spelling, try fewer or broader words
                  {type ? ', or search across all types' : ''}. If you were after something
                  specific, the contact page reaches a person.
                </p>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  {type ? (
                    <button type="button" className={btnOrange} onClick={() => go({ type: '' })}>
                      Search all types
                    </button>
                  ) : null}
                  <a className={btnOutline} href="/contact">
                    Contact us
                  </a>
                </div>
              </div>
            ) : null}

            {state === 'ready' && total > 0 ? (
              <ul className="flex flex-col gap-px border border-line bg-line">
                {data?.results.map((hit) => (
                  <li key={`${hit.type}-${hit.id}`} className="bg-white">
                    <a className="group flex flex-col gap-2 p-5.5 sm:p-6" href={hit.url}>
                      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.688rem] tracking-[0.16em] text-zinc-500 uppercase">
                        <span className="text-rust">{TYPE_LABEL[hit.type]}</span>
                        <span>{formatDate(hit.publishedAt)}</span>
                      </p>
                      <h2 className="text-[1.1875rem] leading-[1.35] font-normal tracking-normal text-ink group-hover:text-rust">
                        {hit.title}
                      </h2>
                      {hit.excerpt ? (
                        <p className="max-w-170 text-[0.875rem] leading-[1.65] text-zinc-600">
                          {hit.excerpt}
                        </p>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {state === 'ready' && totalPages > 1 ? (
              <nav
                className="mt-9 flex items-center justify-between gap-4 border-t border-line pt-6 sm:mt-12"
                aria-label="Pagination"
              >
                {page > 1 ? (
                  <a className={pageLink} href={pageHref(page - 1)}>
                    ← Previous
                  </a>
                ) : (
                  <span />
                )}
                <p className="font-mono text-[0.781rem] tracking-[0.1em] text-zinc-700">
                  Page {page} of {totalPages}
                </p>
                {page < totalPages ? (
                  <a className={pageLink} href={pageHref(page + 1)}>
                    Next →
                  </a>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
