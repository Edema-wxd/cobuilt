import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/router';
import SiteLayout from '../../components/SiteLayout';
import { passportHref } from '../../components/site';
import {
  btnOrange,
  btnOutline,
  container,
  eyebrowOnDark,
  eyebrowOnLine,
  media,
} from '../../components/ui';

/**
 * Projects index — `/projects`.
 *
 * Built from the handoff mockup "CoBuilt Projects" (direction 3c). The page
 * reads `/api/projects` on the client rather than in `getServerSideProps`: the
 * list endpoint needs PostgreSQL, and a checkout without a database should
 * still render the page and say plainly that the list could not be loaded,
 * which is the state the mockup designs for. Filters live in the query string,
 * so a filtered view is shareable and the back button works.
 *
 * Two brief constraints hold here as they do on the landing page: no
 * investment call to action — the closing band registers interest and carries
 * the licensing notice — and every interactive control is at least 44px.
 *
 * Fields the mockup shows that the list endpoint does not yet return, and
 * which therefore degrade rather than appear:
 *   - the project reference code (CB-2024-014) in the card's mono slot;
 *   - `passport.progress` (stage and percent) for the card progress bar, which
 *     today only the detail endpoint carries;
 *   - a tag facet — `/api/search/facets?type=project` returns statuses, types,
 *     locations and sectors, so the Tag filter renders only once tags are
 *     added to that response, though `?tag=` filtering already works.
 * See docs/design-handover.md §3.3.
 */

const PAGE_SIZE = 12;

type Status = 'future' | 'ongoing' | 'completed';
type Sort = 'recent' | 'title' | 'oldest';

interface ApiProject {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: Status;
  projectType: string | null;
  location: string | null;
  sector: string | null;
  featuredImageUrl: string | null;
  passport: {
    enabled: boolean;
    startDate: string | null;
    completionTarget: string | null;
    /** Not returned by the list endpoint yet; rendered if it ever is. */
    progress?: { percent: number; stage?: string | null } | null;
  };
}

interface ProjectPage {
  results: ApiProject[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface Facet {
  value: string;
  label?: string;
  count: number;
}

interface Facets {
  statuses: Facet[];
  types: Facet[];
  locations: Facet[];
  sectors: Facet[];
  /** Absent today; see the header comment. */
  tags?: Facet[];
}

/** The four filters the API accepts as a slug or a UUID, in mockup order. */
const SELECTS = [
  { key: 'type', label: 'Type', all: 'All types', facet: 'types' },
  { key: 'location', label: 'Location', all: 'All locations', facet: 'locations' },
  { key: 'sector', label: 'Sector', all: 'All sectors', facet: 'sectors' },
  { key: 'tag', label: 'Tag', all: 'Any tag', facet: 'tags' },
] as const;

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'recent', label: 'Most recent' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'oldest', label: 'Oldest first' },
];

/** "Upcoming" is the client-facing word for the API's `future`. */
const STATUS_PILLS: Array<{ value: Status | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'future', label: 'Upcoming' },
];

const STATUS_LABEL: Record<Status, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  future: 'Upcoming',
};

const badge = 'whitespace-nowrap px-2.5 py-1.25 text-[0.625rem] font-bold uppercase tracking-[0.14em]';

const STATUS_CLASS: Record<Status, string> = {
  ongoing: `${badge} bg-orange text-ink`,
  completed: `${badge} bg-ink text-white`,
  future: `${badge} bg-line text-ink`,
};

/** What the card's corner link promises, by stage. */
const LINK_LABEL: Record<Status, string> = {
  ongoing: 'Passport →',
  completed: 'Record →',
  future: 'Vision →',
};

const HERO_STATS = [
  { value: '5', plus: true, label: 'Delivered' },
  { value: '3', label: 'Under development' },
  { value: '30', plus: true, label: 'Units' },
  { value: '5', plus: true, label: 'Locations' },
];

const fieldLabel = 'text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-zinc-700';
/** 16px on a phone: below that, iOS Safari zooms the page when a field takes focus. */
const control =
  'min-h-11.5 w-full rounded-none border border-zinc-500 bg-white px-3.5 text-base text-ink sm:text-[0.875rem]';
const select = `${control} select-chevron pr-10`;
const pill =
  'inline-flex min-h-target flex-none cursor-pointer items-center gap-2 border px-4.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em]';
const uppercaseLink = 'font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover';

/** Query values arrive as `string | string[] | undefined`; the API takes one. */
function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

function toPage(value: string | string[] | undefined): number {
  const page = Number.parseInt(first(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function facetLabel(facets: Facets | null, group: keyof Facets, value: string): string {
  const match = facets?.[group]?.find((option) => option.value === value);
  return match?.label ?? match?.value ?? value;
}

/** Static skeleton — no shimmer, per the motion rule. */
function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="flex flex-col border border-line">
          <div className="aspect-[16/10] bg-line sm:aspect-auto sm:h-57.5" />
          <div className="flex flex-col gap-3 p-5.5 sm:p-6.5">
            <div className="h-2.5 w-2/5 bg-line" />
            <div className="h-4.5 w-3/4 bg-line" />
            <div className="h-2.5 w-11/12 bg-zinc-100" />
            <div className="h-2.5 w-3/5 bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProjectsIndex() {
  const router = useRouter();
  const query = router.query;

  const status = first(query.status);
  const sort = (first(query.sort) || 'recent') as Sort;
  const q = first(query.q);
  const page = toPage(query.page);

  const [facets, setFacets] = useState<Facets | null>(null);
  const [data, setData] = useState<ProjectPage | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftQ, setDraftQ] = useState('');
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);

  // The URL is the single source of truth for filters; the text field keeps a
  // local draft only so typing is not one router push per keystroke.
  useEffect(() => {
    if (!router.isReady) return;
    setDraftQ(q);
  }, [router.isReady, q]);

  const setQuery = useCallback(
    (changes: Record<string, string>) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries({ ...router.query, ...changes })) {
        const single = first(value);
        // A cleared filter leaves the URL rather than sitting in it as an empty
        // parameter, and any filter change returns to the first page.
        if (single && !(key === 'page' && single === '1')) next[key] = single;
      }
      void router.push({ pathname: '/projects', query: next }, undefined, { scroll: false });
    },
    [router],
  );

  // Debounced, so a search is one request after typing stops rather than one
  // per character. Submitting the form applies it immediately.
  useEffect(() => {
    if (!router.isReady || draftQ === q) return;
    const timer = setTimeout(() => setQuery({ q: draftQ, page: '1' }), 400);
    return () => clearTimeout(timer);
  }, [draftQ, q, router.isReady, setQuery]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/search/facets?type=project', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: Facets | null) => {
        if (payload) setFacets(payload);
      })
      .catch(() => {
        // Filters fall back to the plain "all" option; the list still loads.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const controller = new AbortController();
    setState('loading');

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
    for (const key of ['status', 'type', 'location', 'sector', 'tag', 'q'] as const) {
      const value = first(query[key]);
      if (value) params.set(key, value);
    }

    fetch(`/api/projects?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as ProjectPage;
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
  }, [router.isReady, query, page, sort, attempt]);

  // The phone filter sheet is a dialog: Escape closes it, focus moves into it
  // and back to the button that opened it, and the page behind it cannot scroll.
  useEffect(() => {
    if (!sheetOpen) return;
    sheetCloseRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setSheetOpen(false);
      filtersButtonRef.current?.focus();
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [sheetOpen]);

  const active: Array<{ key: string; label: string }> = [];
  if (status) {
    active.push({ key: 'status', label: STATUS_LABEL[status as Status] ?? status });
  }
  for (const item of SELECTS) {
    const value = first(query[item.key]);
    if (value) active.push({ key: item.key, label: facetLabel(facets, item.facet, value) });
  }
  if (q) active.push({ key: 'q', label: `“${q}”` });

  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  function clearAll(): void {
    setDraftQ('');
    void router.push('/projects', undefined, { scroll: false });
  }

  /**
   * The same four selects render twice — inline above `sm`, and inside the
   * phone sheet — so each instance needs its own ids. Two elements sharing an
   * id makes every duplicate `<label for>` resolve to the first one, which
   * here is the copy that is hidden at that width: the sheet's labels would
   * point at controls the pointer cannot reach.
   */
  function renderSelects(instance: string): ReactElement[] {
    return SELECTS.map((item) => {
      const options = facets?.[item.facet] ?? [];
      // A filter with nothing behind it is not offered — except the one the URL
      // already carries, which must stay selectable so it can be cleared.
      const value = first(query[item.key]);
      if (options.length === 0 && !value) return <div key={item.key} className="hidden" />;

      // A value the facets do not list — a stale `?tag=`, or a facet group the
      // API does not return yet — would otherwise select nothing and render
      // blank, hiding a filter that is actually narrowing the results.
      const listed = options.some((option) => option.value === value);
      const fieldId = `${instance}-filter-${item.key}`;

      return (
        <div key={item.key} className="flex flex-col gap-1.75">
          <label className={fieldLabel} htmlFor={fieldId}>
            {item.label}
          </label>
          <select
            id={fieldId}
            className={select}
            value={value}
            onChange={(event) => setQuery({ [item.key]: event.target.value, page: '1' })}
          >
            <option value="">{item.all}</option>
            {value && !listed ? <option value={value}>{value}</option> : null}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label ?? option.value} ({option.count})
              </option>
            ))}
          </select>
        </div>
      );
    });
  }

  return (
    <SiteLayout
      title="Projects — CoBuilt Investment Partners"
      description="Completed, under construction and planned developments from CoBuilt Investment Partners, each linked to its Project Passport™ — a dated, public record from commencement to handover."
      current="/projects"
    >
      <main>
        <nav
          className="border-b border-line bg-white"
          aria-label="Breadcrumb"
        >
          <div className={`${container} flex min-h-12 items-center gap-3 text-[0.781rem]`}>
            <a className="inline-flex min-h-target items-center text-zinc-600 hover:text-rust" href="/">
              Home
            </a>
            <span className="text-zinc-400" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-ink" aria-current="page">
              Projects
            </span>
          </div>
        </nav>

        <section className="bg-ink py-13 text-white md:py-18">
          <div
            className={`${container} grid grid-cols-1 items-end gap-9 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14`}
          >
            <div className="flex flex-col gap-4.5 [&_h1_em]:text-orange-on-dark">
              <p className={eyebrowOnDark}>Our projects</p>
              <h1 className="text-[length:clamp(2rem,4.6vw,3.5rem)]">
                Every development, with its <em>record attached</em>.
              </h1>
              <p className="max-w-150 text-base leading-[1.8] text-zinc-200">
                Completed, under construction and planned. Each project links to its Project
                Passport™ — a dated, public record from commencement to handover.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-px border border-line-on-dark bg-line-on-dark">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="bg-ink p-5.5">
                  <dd className="text-[2.25rem] leading-none font-light">
                    {stat.value}
                    {stat.plus ? <span className="text-[1.25rem]">+</span> : null}
                  </dd>
                  <dt className="mt-2 text-[0.688rem] uppercase tracking-[0.16em] text-zinc-200">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-b border-line bg-zinc-100 py-7 sm:py-9">
          <div className={`${container} flex flex-col gap-5.5`}>
            <form
              className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-2 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setQuery({ q: draftQ, page: '1' });
              }}
            >
              <div className="flex flex-col gap-1.75">
                <label className={fieldLabel} htmlFor="project-search">
                  Search projects
                </label>
                <input
                  id="project-search"
                  className={control}
                  type="search"
                  placeholder="Name, location or keyword"
                  value={draftQ}
                  onChange={(event) => setDraftQ(event.target.value)}
                />
              </div>
              {/* The dropdowns collapse behind "Filters" on a phone. */}
              <div className="contents max-sm:hidden">{renderSelects('bar')}</div>
            </form>

            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              {/* One scrolling row on a phone, bled to the screen edge. */}
              <div
                className="-mx-gutter flex w-[calc(100%+2*var(--spacing-gutter))] gap-2 overflow-x-auto px-gutter py-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:p-0 [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Filter projects by stage"
              >
                {STATUS_PILLS.map((option) => {
                  const selected = status === option.value;
                  const count = option.value
                    ? facets?.statuses.find((item) => item.value === option.value)?.count
                    : facets?.statuses.reduce((sum, item) => sum + item.count, 0);

                  return (
                    <button
                      key={option.label}
                      type="button"
                      className={
                        selected
                          ? `${pill} border-ink bg-ink text-white`
                          : `${pill} border-zinc-500 bg-white text-ink hover:border-ink`
                      }
                      aria-pressed={selected}
                      onClick={() => setQuery({ status: option.value, page: '1' })}
                    >
                      {option.label}
                      {count === undefined ? null : (
                        <span
                          className={`font-mono text-[0.688rem] ${selected ? 'text-zinc-200' : 'text-zinc-600'}`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <button
                  ref={filtersButtonRef}
                  type="button"
                  className={`${pill} border-zinc-500 bg-white text-ink hover:border-ink sm:hidden`}
                  aria-expanded={sheetOpen}
                  onClick={() => setSheetOpen(true)}
                >
                  Filters
                  {active.filter((item) => item.key !== 'status' && item.key !== 'q').length > 0 ? (
                    <span className="font-mono text-[0.688rem] text-zinc-600">
                      {active.filter((item) => item.key !== 'status' && item.key !== 'q').length}
                    </span>
                  ) : null}
                </button>

                <label className={`${fieldLabel} hidden sm:block`} htmlFor="project-sort">
                  Sort
                </label>
                <select
                  id="project-sort"
                  className={`${select} min-h-target sm:w-42.5`}
                  aria-label="Sort projects"
                  value={sort}
                  onChange={(event) => setQuery({ sort: event.target.value, page: '1' })}
                >
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-11 sm:py-14 md:py-18">
          <div className={`${container} flex flex-col gap-9`}>
            <div aria-live="polite" aria-busy={state === 'loading'}>
              {state === 'loading' ? (
                <>
                  <p className="mb-5 text-[0.844rem] text-zinc-700">Loading projects…</p>
                  <Skeleton />
                </>
              ) : null}

              {state === 'error' ? (
                <div className="flex flex-col items-start gap-3.5 border border-zinc-300 p-7 sm:p-9">
                  <h2 className="text-[length:clamp(1.5rem,2.4vw,2.125rem)]">
                    Projects couldn&rsquo;t be loaded just now.
                  </h2>
                  <p className="text-[0.938rem] leading-[1.7] text-zinc-700">
                    This is on our side. Please try again in a moment.
                  </p>
                  <button
                    type="button"
                    className={btnOutline}
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {state === 'ready' && total === 0 ? (
                <div className="flex flex-col items-start gap-4.5 border border-zinc-300 p-7 sm:p-10">
                  {active.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {active.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className="inline-flex min-h-target items-center gap-2.5 border border-ink pr-2 pl-3.5 text-[0.813rem] text-ink hover:bg-zinc-100"
                          onClick={() => {
                            if (item.key === 'q') setDraftQ('');
                            setQuery({ [item.key]: '', page: '1' });
                          }}
                        >
                          {item.label}
                          <span className="flex size-7 items-center justify-center text-[0.938rem]" aria-hidden="true">
                            ×
                          </span>
                          <span className="sr-only">Remove filter</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <h2 className="text-[length:clamp(1.5rem,2.4vw,2.125rem)]">
                    {active.length > 0
                      ? 'No projects match these filters.'
                      : 'No projects have been published yet.'}
                  </h2>
                  <p className="max-w-130 text-[0.938rem] leading-[1.7] text-zinc-700">
                    {active.length > 0
                      ? 'Try removing a filter, or browse the full portfolio.'
                      : 'Developments appear here as they are published, each with its Project Passport™ attached.'}
                  </p>
                  {active.length > 0 ? (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button type="button" className={btnOrange} onClick={clearAll}>
                        Clear all filters
                      </button>
                      <a className={btnOutline} href="/#register">
                        Register your interest
                      </a>
                    </div>
                  ) : (
                    <a className={btnOrange} href="/#register">
                      Register your interest
                    </a>
                  )}
                </div>
              ) : null}

              {state === 'ready' && total > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                  {data?.results.map((project) => {
                    const specs = [project.projectType, project.sector].filter(
                      (value): value is string => Boolean(value),
                    );
                    const progress = project.passport.progress;
                    const passportLink = passportHref(project.slug);

                    return (
                      <article key={project.id} className="flex flex-col border border-line bg-white">
                        {project.featuredImageUrl ? (
                          <div
                            className={`${media} aspect-[16/10] sm:aspect-auto sm:h-57.5`}
                            style={{ backgroundImage: `url('${project.featuredImageUrl}')` }}
                            role="img"
                            aria-label={`${project.title}${project.location ? `, ${project.location}` : ''}`}
                          />
                        ) : (
                          <div className="flex aspect-[16/10] items-end bg-line p-4 sm:aspect-auto sm:h-57.5">
                            <span className="text-[0.688rem] uppercase tracking-[0.16em] text-zinc-600">
                              Image to follow
                            </span>
                          </div>
                        )}

                        <div className="flex flex-1 flex-col gap-3.25 p-5.5 sm:p-6.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[0.656rem] uppercase tracking-[0.16em] text-zinc-600">
                              {project.location ?? 'Location to follow'}
                            </span>
                            <span className={STATUS_CLASS[project.status]}>
                              {STATUS_LABEL[project.status]}
                            </span>
                          </div>

                          <h2 className="text-[1.5rem] font-normal tracking-[-0.02em]">
                            <a className="text-ink hover:text-rust" href={`/projects/${project.slug}`}>
                              {project.title}
                            </a>
                          </h2>

                          {project.description ? (
                            <p className="text-[0.906rem] leading-[1.55] text-zinc-600 italic">
                              {project.description}
                            </p>
                          ) : null}

                          {specs.length > 0 ? (
                            <div className="flex flex-col gap-2 border-t border-line pt-2">
                              {specs.map((spec) => (
                                <p key={spec} className="text-[0.844rem] text-zinc-700">
                                  {spec}
                                </p>
                              ))}
                            </div>
                          ) : null}

                          {progress ? (
                            <div className="flex flex-col gap-1.75 pt-1.5">
                              <p className="flex justify-between text-[0.75rem] text-ink-mid">
                                <span>{progress.stage ?? 'Programme'}</span>
                                <b className="font-semibold">{progress.percent}%</b>
                              </p>
                              <div
                                className="h-1.25 overflow-hidden bg-line"
                                role="progressbar"
                                aria-label={`${project.title} programme progress`}
                                aria-valuenow={progress.percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <div className="h-full bg-rust" style={{ width: `${progress.percent}%` }} />
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                            {project.passport.completionTarget ? (
                              <span className="font-mono text-[0.656rem] uppercase tracking-[0.1em] text-zinc-600">
                                Target {project.passport.completionTarget}
                              </span>
                            ) : (
                              <span />
                            )}
                            <a
                              className={`${uppercaseLink} -my-3.25 inline-flex min-h-target items-center text-[0.688rem] whitespace-nowrap sm:my-0 sm:inline sm:min-h-0`}
                              href={project.passport.enabled ? passportLink : `/projects/${project.slug}`}
                            >
                              <span className="sr-only">{project.title} — </span>
                              {project.passport.enabled ? LINK_LABEL[project.status] : 'Project →'}
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {state === 'ready' && totalPages > 1 ? (
              <div className="flex flex-col items-start gap-4 border-t border-line pt-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <p className="text-[0.844rem] text-zinc-700">
                  Showing{' '}
                  <span className="font-mono">
                    {firstRow}–{lastRow}
                  </span>{' '}
                  of <span className="font-mono">{total}</span> projects
                </p>

                <nav className="flex flex-wrap gap-1.5" aria-label="Pagination">
                  <button
                    type="button"
                    className={`inline-flex min-h-target items-center border px-4 text-[0.719rem] font-semibold uppercase tracking-[0.14em] ${
                      page === 1
                        ? 'border-line text-zinc-500'
                        : 'cursor-pointer border-zinc-500 text-ink hover:border-ink'
                    }`}
                    disabled={page === 1}
                    onClick={() => setQuery({ page: String(page - 1) })}
                  >
                    ← Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                    <button
                      key={number}
                      type="button"
                      className={`inline-flex size-target cursor-pointer items-center justify-center border font-mono text-[0.813rem] ${
                        number === page
                          ? 'border-ink bg-ink text-white'
                          : 'border-zinc-500 text-ink hover:border-ink'
                      }`}
                      aria-current={number === page ? 'page' : undefined}
                      aria-label={`Page ${number}`}
                      onClick={() => setQuery({ page: String(number) })}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={`inline-flex min-h-target items-center border px-4 text-[0.719rem] font-semibold uppercase tracking-[0.14em] ${
                      page >= totalPages
                        ? 'border-line text-zinc-500'
                        : 'cursor-pointer border-zinc-500 text-ink hover:border-ink'
                    }`}
                    disabled={page >= totalPages}
                    onClick={() => setQuery({ page: String(page + 1) })}
                  >
                    Next →
                  </button>
                </nav>
              </div>
            ) : null}
          </div>
        </section>

        {/* No investment call to action: the closing band registers interest only. */}
        <section className="bg-line py-11 sm:py-14">
          <div
            className={`${container} flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between md:gap-12`}
          >
            <div className="flex flex-col gap-3 [&_h2_em]:text-rust">
              <p className={eyebrowOnLine}>Register your interest</p>
              <h2 className="text-[length:clamp(1.5rem,2.4vw,2.125rem)]">
                Hear when a new development <em>opens its record</em>.
              </h2>
              <p className="max-w-160 text-[0.844rem] leading-[1.7] text-zinc-700">
                This is an information request only. CoBuilt Investment Partners does not currently
                offer or solicit investment. An Investor Portal will be introduced once all required
                regulatory approvals and licences are in place.
              </p>
            </div>
            <a className={`${btnOrange} w-full md:w-auto`} href="/#register">
              Register your interest
            </a>
          </div>
        </section>
      </main>

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/60 sm:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSheetOpen(false);
              filtersButtonRef.current?.focus();
            }
          }}
        >
          <div
            className="max-h-[85dvh] overflow-y-auto overscroll-contain border-t border-line bg-white px-gutter pt-4 pb-6"
            role="dialog"
            aria-modal="true"
            aria-label="Filter projects"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className={fieldLabel}>Filters</p>
              <button
                ref={sheetCloseRef}
                type="button"
                className="inline-flex size-target cursor-pointer items-center justify-center border border-zinc-500 text-[1.125rem]"
                onClick={() => {
                  setSheetOpen(false);
                  filtersButtonRef.current?.focus();
                }}
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">Close filters</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">{renderSelects('sheet')}</div>

            <div className="mt-6 flex gap-3">
              <button type="button" className={`${btnOutline} flex-1`} onClick={clearAll}>
                Clear
              </button>
              <button
                type="button"
                className={`${btnOrange} flex-1`}
                onClick={() => {
                  setSheetOpen(false);
                  filtersButtonRef.current?.focus();
                }}
              >
                {state === 'ready' ? `Show ${total} result${total === 1 ? '' : 's'}` : 'Show results'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SiteLayout>
  );
}
