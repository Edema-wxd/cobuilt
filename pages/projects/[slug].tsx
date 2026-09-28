import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import SiteLayout from '../../components/SiteLayout';
import { passportHref } from '../../components/site';
import {
  btnOrange,
  btnOutline,
  btnOutlineOnDark,
  btnWhite,
  container,
  eyebrow,
  eyebrowOnDark,
  eyebrowOnLine,
  media,
} from '../../components/ui';

/**
 * Project detail — `/projects/[slug]`.
 *
 * Built from the handoff mockup "CoBuilt Project Detail" (direction 3c).
 *
 * Unlike `/projects`, this page renders on the server. A project page is the
 * canonical, shareable URL for a development: it needs the project's own SEO
 * fields in the document head, an Open Graph image for link previews, and a
 * real 404 for a slug that does not exist — none of which a client-side fetch
 * gives. It reads the repositories directly rather than calling its own API
 * over HTTP, so there is one round trip and the response shape is guaranteed
 * by the same serializers the API uses. A checkout with no database still
 * renders: the load is wrapped, and a failure shows the "couldn't be loaded"
 * state rather than a 500. See docs/decisions.md §2.10.
 *
 * Brief constraints, as everywhere: no investment call to action — the
 * investor band resolves to "Register your interest" in both its states, and
 * carries the licensing notice — and every control is at least 44px.
 *
 * What the mockup shows that the data does not carry, and which therefore
 * degrades rather than appears:
 *   - the project reference code (CB-2024-014) in the hero's mono slot, which
 *     no column exists for (as on the index, docs/decisions.md §2.9);
 *   - image captions ("Render · north elevation") — `gallery_albums` stores
 *     URLs only, so the hero and gallery images run without them.
 */

type Status = 'future' | 'ongoing' | 'completed';
type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';
type TourType = 'threejs_model' | 'matterport_embed' | 'custom_viewer';

interface Label {
  id: string;
  name: string;
  slug: string;
}

interface Tour {
  id: string;
  name: string;
  type: TourType;
  description: string | null;
  thumbnailUrl: string | null;
  /**
   * The tour URL, but only when it is one this page will actually frame:
   * https, and not the raw model file a `threejs_model` carries. Vetted on the
   * server so no unchecked, editor-supplied URL reaches the browser at all.
   */
  embedUrl: string | null;
  fileSizeBytes: number | null;
  featured: boolean;
}

interface PassportSummary {
  total: number;
  completed: number;
  percent: number;
  /** The most recent entry recorded against the record, not a milestone date. */
  lastEntry: string | null;
  next: { label: string; status: MilestoneStatus; scheduledDate: string | null } | null;
}

interface RelatedProject {
  id: string;
  title: string;
  slug: string;
  status: Status;
  location: string | null;
  featuredImageUrl: string | null;
}

interface Project {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  longDescription: string | null;
  status: Status;
  projectType: string | null;
  location: string | null;
  sector: string | null;
  featuredImageUrl: string | null;
  passport: { enabled: boolean; startDate: string | null; completionTarget: string | null };
  investor: {
    investmentAmount: number | null;
    expectedRoi: number | null;
    highlights: unknown;
  } | null;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    openGraphImageUrl: string | null;
    canonicalUrl: string | null;
  };
}

interface Props {
  project: Project | null;
  services: Label[];
  tags: Label[];
  images: string[];
  tours: Tour[];
  passport: PassportSummary | null;
  related: RelatedProject[];
}

const STATUS_LABEL: Record<Status, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  future: 'Upcoming',
};

const badge =
  'whitespace-nowrap px-2.5 py-1.25 text-[0.625rem] font-bold uppercase tracking-[0.14em]';

const STATUS_CLASS: Record<Status, string> = {
  ongoing: `${badge} bg-orange text-ink`,
  completed: `${badge} bg-ink text-white`,
  future: `${badge} bg-line text-ink`,
};

/**
 * A delayed milestone is reported, not hidden — the brand promise rests on it —
 * so it reads as a plain outlined chip rather than an error colour.
 */
const MILESTONE_STATUS_CLASS: Record<MilestoneStatus, string> = {
  completed: `${badge} bg-ink text-white`,
  in_progress: `${badge} bg-orange text-ink`,
  delayed: `${badge} border border-ink bg-white text-ink`,
  pending: `${badge} bg-line text-ink`,
};

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  delayed: 'Delayed',
  pending: 'Scheduled',
};

/**
 * Whether this page can open a given tour.
 *
 * `threejs_model` always carries a `tour_url` — the admin route fills it with
 * the public URL of the .glb itself — so presence of a URL says nothing about
 * whether it can be framed. Only the type does: a model needs a WebGL viewer
 * this site does not have, while a Matterport or custom viewer is a web page.
 * A `matterport_embed` may also carry only `embed_code`, which is CMS-authored
 * HTML this page will not inject, and so cannot be opened either.
 */
function tourSupport(tour: Tour): 'embed' | 'model' | 'unavailable' {
  if (tour.type === 'threejs_model') return 'model';
  return tour.embedUrl ? 'embed' : 'unavailable';
}

const TOUR_TYPE_LABEL: Record<TourType, string> = {
  threejs_model: 'Three.js model',
  matterport_embed: 'Matterport',
  custom_viewer: 'Custom viewer',
};

const uppercaseLink =
  'inline-flex min-h-target items-center text-[0.719rem] font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover';
const sectionTitle = 'text-[length:clamp(1.75rem,3vw,2.5rem)]';
const blockHead =
  'text-[0.719rem] font-semibold uppercase tracking-[0.2em] text-ink';

/**
 * Image URLs are editor- and CMS-supplied and land inside a CSS `url('…')`.
 * An apostrophe would close the string early — at best breaking the tile, at
 * worst letting the rest of the URL be read as further declarations.
 */
function cssUrl(url: string): string {
  return `url('${url.replace(/[\\'"()\n\r]/g, (char) => `\\${char}`)}')`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Date-only values are formatted by hand from their parts. `new Date('2026-01-15')`
 * parses as UTC midnight and then prints in the viewer's zone, which west of
 * UTC shows the day before — on a record whose whole claim is that its dates
 * are accurate, that is not a rounding error.
 */
function formatDay(value: string | null): string | null {
  const parts = value?.slice(0, 10).split('-');
  if (!parts || parts.length !== 3) return null;
  const [year, month, day] = parts;
  const name = MONTHS[Number(month) - 1];
  if (!year || !day || !name) return null;
  return `${Number(day)} ${name} ${year}`;
}

/** Completion targets are a commitment to a quarter, not to a day. */
function formatQuarter(value: string | null): string | null {
  const parts = value?.slice(0, 10).split('-');
  if (!parts || parts.length !== 3) return null;
  const [year, month] = parts;
  if (!year || !month) return null;
  return `Q${Math.floor((Number(month) - 1) / 3) + 1} ${year}`;
}

function formatBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / 1_000_000;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/** ₦1.25B — figures are published for information, never as an offer. */
function formatNaira(amount: number | null): string | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  if (amount >= 1e9) return `₦${Number((amount / 1e9).toFixed(2))}B`;
  if (amount >= 1e6) return `₦${Number((amount / 1e6).toFixed(1))}M`;
  return `₦${amount.toLocaleString('en-NG')}`;
}

function sentenceCase(key: string): string {
  const spaced = key.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * `investor_highlights` is jsonb, so it arrives as a list of statements, as an
 * object of labelled facts, or as one string. All three become bullet lines.
 */
function highlightLines(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== '')
      .map(([key, item]) => `${sentenceCase(key)}: ${String(item)}`);
  }
  return [];
}

/** CMS long copy is plain text; blank lines are its paragraph breaks. */
function paragraphs(value: string | null): string[] {
  return (value ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The title with its last word italicised, which is the house headline form. */
function AccentedTitle({ title }: { title: string }): ReactElement {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return <>{title}</>;
  const accent = words[words.length - 1];
  return (
    <>
      {words.slice(0, -1).join(' ')} <em>{accent}</em>
    </>
  );
}

export default function ProjectDetail({
  project,
  services,
  tags,
  images,
  tours,
  passport,
  related,
}: Props) {
  const [activeTourId, setActiveTourId] = useState<string | null>(
    tours.find((tour) => tour.featured)?.id ?? tours[0]?.id ?? null,
  );
  const [tourState, setTourState] = useState<'idle' | 'loading' | 'open' | 'unsupported'>('idle');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const enterTourRef = useRef<HTMLButtonElement>(null);

  const activeTour = tours.find((tour) => tour.id === activeTourId) ?? null;

  const exitTour = useCallback(() => {
    setTourState('idle');
    if (document.fullscreenElement) void document.exitFullscreen();
    enterTourRef.current?.focus();
  }, []);

  // Escape leaves the tour, as the viewer chrome promises it does.
  useEffect(() => {
    if (tourState !== 'open' && tourState !== 'loading') return;

    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') exitTour();
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tourState, exitTour]);

  if (!project) {
    return (
      <SiteLayout
        title="Project — CoBuilt Investment Partners"
        description="This project could not be loaded."
        current="/projects"
      >
        <main className="bg-white py-14 md:py-20">
          <div className={`${container} flex max-w-160 flex-col items-start gap-4`}>
            <h1 className={sectionTitle}>This project couldn&rsquo;t be loaded just now.</h1>
            <p className="text-[0.938rem] leading-[1.7] text-zinc-700">
              This is on our side, not yours. Please try again in a moment, or browse the rest of
              the portfolio.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a className={btnOrange} href="/projects">
                All projects
              </a>
              <a className={btnOutline} href="/#register">
                Register your interest
              </a>
            </div>
          </div>
        </main>
      </SiteLayout>
    );
  }

  const title = project.seo.metaTitle ?? `${project.title} — CoBuilt Investment Partners`;
  const description =
    project.seo.metaDescription ??
    project.description ??
    `${project.title}: a CoBuilt development with its Project Passport™ — a dated, public record from commencement to handover.`;
  const shareImage = project.seo.openGraphImageUrl ?? project.featuredImageUrl;
  // Until the Passport page exists this is an anchor to the band below, so the
  // band's own "open the full record" link would only point at itself.
  const passportLink = passportHref(project.slug);

  const specs: Array<{ label: string; value: string; mono?: boolean }> = [];
  if (project.projectType) specs.push({ label: 'Type', value: project.projectType });
  if (project.location) specs.push({ label: 'Location', value: project.location });
  if (project.sector) specs.push({ label: 'Sector', value: project.sector });
  const opened = formatDay(project.passport.startDate);
  if (project.passport.enabled && opened) {
    specs.push({ label: 'Passport opened', value: opened, mono: true });
  }
  const target = formatQuarter(project.passport.completionTarget);
  if (target) specs.push({ label: 'Completion target', value: target, mono: true });

  const body = paragraphs(project.longDescription);
  const highlights = highlightLines(project.investor?.highlights);
  const amount = formatNaira(project.investor?.investmentAmount ?? null);
  const roi = project.investor?.expectedRoi ?? null;
  const shownImages = galleryOpen ? images : images.slice(0, 5);
  const lastEntry = formatDay(passport?.lastEntry ?? null);
  const tourSize = formatBytes(activeTour?.fileSizeBytes ?? null);

  return (
    <SiteLayout
      title={title}
      description={description}
      current="/projects"
      {...(project.featuredImageUrl ? { preloadImage: project.featuredImageUrl } : {})}
    >
      <Head>
        {project.seo.canonicalUrl ? <link rel="canonical" href={project.seo.canonicalUrl} /> : null}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={project.title} />
        <meta property="og:description" content={description} />
        {shareImage ? <meta property="og:image" content={shareImage} /> : null}
        <meta name="twitter:card" content={shareImage ? 'summary_large_image' : 'summary'} />
      </Head>

      <main>
        <nav className="border-b border-line bg-white" aria-label="Breadcrumb">
          <div className={`${container} flex min-h-12 items-center gap-3 text-[0.781rem]`}>
            <a className="inline-flex min-h-target items-center text-zinc-600 hover:text-rust" href="/">
              Home
            </a>
            <span className="text-zinc-400" aria-hidden="true">
              /
            </span>
            <a
              className="inline-flex min-h-target items-center text-zinc-600 hover:text-rust"
              href="/projects"
            >
              Projects
            </a>
            <span className="text-zinc-400" aria-hidden="true">
              /
            </span>
            <span className="truncate font-semibold text-ink" aria-current="page">
              {project.title}
            </span>
          </div>
        </nav>

        <section className="bg-ink py-13 text-white md:py-18">
          <div
            className={`${container} grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14`}
          >
            <div className="flex flex-col gap-5.5 [&_h1_em]:text-orange-on-dark">
              <div className="flex items-center gap-3.5">
                <span className={STATUS_CLASS[project.status]}>{STATUS_LABEL[project.status]}</span>
                {project.passport.enabled ? (
                  <span className="font-mono text-[0.781rem] tracking-[0.06em] text-orange-on-dark">
                    Passport™ open
                  </span>
                ) : null}
              </div>

              <h1 className="text-[length:clamp(2.25rem,5.4vw,4rem)]">
                <AccentedTitle title={project.title} />
              </h1>

              {project.description ? (
                <p className="max-w-145 text-[1.063rem] leading-[1.75] text-zinc-200">
                  {project.description}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 pt-1.5 sm:flex-row sm:flex-wrap">
                {project.passport.enabled ? (
                  <a className={btnOrange} href={passportLink}>
                    View Project Passport™
                  </a>
                ) : null}
                {tours.length > 0 ? (
                  <a className={btnOutlineOnDark} href="#tours">
                    Enter the virtual tour
                  </a>
                ) : null}
              </div>
            </div>

            {specs.length > 0 ? (
              <dl className="flex flex-col border-b border-line-on-dark">
                {specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex justify-between gap-5 border-t border-line-on-dark py-3.25 text-[0.875rem]"
                  >
                    <dt className="text-zinc-200">{spec.label}</dt>
                    <dd className={`text-right text-white ${spec.mono ? 'font-mono' : ''}`}>
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>

        {project.featuredImageUrl ? (
          <div
            className={`${media} h-60 sm:h-90 md:h-130`}
            style={{ backgroundImage: cssUrl(project.featuredImageUrl) }}
            role="img"
            aria-label={`${project.title}${project.location ? `, ${project.location}` : ''}`}
          />
        ) : (
          <div className="flex h-45 items-end bg-line sm:h-60">
            <div className={`${container} pb-5`}>
              <p className="text-[0.719rem] uppercase tracking-[0.16em] text-zinc-600">
                Imagery to follow
              </p>
            </div>
          </div>
        )}

        {passport ? (
          <section id="passport" className="border-b border-line bg-white py-8 md:py-10">
            <div
              className={`${container} grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_300px] md:items-center lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:gap-11`}
            >
              <div className="flex flex-col gap-2">
                <p className={eyebrow}>Project Passport™</p>
                <p className="text-[1.875rem] font-light tracking-[-0.03em]">
                  <span className="font-mono text-[1.75rem]">{passport.completed}</span> of{' '}
                  <span className="font-mono text-[1.75rem]">{passport.total}</span> milestones
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <div
                  className="flex gap-1"
                  role="progressbar"
                  aria-label={`${project.title} — Project Passport progress`}
                  aria-valuenow={passport.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {/* A long record is a single bar; a short one keeps its segments. */}
                  {passport.total > 0 && passport.total <= 20 ? (
                    Array.from({ length: passport.total }, (_, index) => (
                      <span
                        key={index}
                        className={`h-2.5 flex-1 ${
                          index < passport.completed
                            ? 'bg-rust'
                            : index === passport.completed
                              ? 'bg-ink'
                              : 'bg-line'
                        }`}
                      />
                    ))
                  ) : (
                    <span className="h-2.5 flex-1 bg-line">
                      <span
                        className="block h-full bg-rust"
                        style={{ width: `${passport.percent}%` }}
                      />
                    </span>
                  )}
                </div>
                <p className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-[0.781rem] text-zinc-700">
                  <span>
                    <span className="font-mono">{passport.percent}%</span> complete
                  </span>
                  {lastEntry ? (
                    <span>
                      Last entry <span className="font-mono">{lastEntry}</span>
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-line pt-5 md:col-span-2 lg:col-span-1 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7">
                <p className="text-[0.688rem] uppercase tracking-[0.16em] text-zinc-600">
                  {passport.next ? 'Next milestone' : 'Record'}
                </p>
                {passport.next ? (
                  <>
                    <p className="flex flex-wrap items-center gap-2.5 text-base">
                      {passport.next.label}
                      <span className={MILESTONE_STATUS_CLASS[passport.next.status]}>
                        {MILESTONE_STATUS_LABEL[passport.next.status]}
                      </span>
                    </p>
                    {formatDay(passport.next.scheduledDate) ? (
                      <p className="text-[0.781rem] text-zinc-700">
                        Scheduled{' '}
                        <span className="font-mono">{formatDay(passport.next.scheduledDate)}</span>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[0.938rem] text-zinc-700">
                    {passport.total === 0
                      ? 'No entries have been recorded yet.'
                      : 'Every milestone is complete.'}
                  </p>
                )}
                <a className={uppercaseLink} href="/#passport">
                  <span className="sr-only">{project.title} — </span>What a Passport™ records →
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {body.length > 0 || services.length > 0 || tags.length > 0 ? (
          <section className="bg-white py-11 sm:py-14 md:py-18">
            <div
              className={`${container} grid grid-cols-1 gap-11 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-18`}
            >
              <div className="flex flex-col gap-5.5 [&_h2_em]:text-rust">
                <p className={eyebrow}>Overview</p>
                <h2 className={sectionTitle}>
                  {project.title}, <em>built in the open</em>.
                </h2>
                {body.length > 0 ? (
                  body.map((part) => (
                    <p key={part.slice(0, 40)} className="text-base leading-[1.8] text-zinc-700">
                      {part}
                    </p>
                  ))
                ) : (
                  <p className="text-base leading-[1.8] text-zinc-700">
                    A fuller description of this development is being prepared. Its Project
                    Passport™ carries the record in the meantime.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-9">
                {services.length > 0 ? (
                  <div className="flex flex-col">
                    <h3 className={`${blockHead} pb-3.5`}>Services on this project</h3>
                    <ul className="flex flex-col border-b border-line">
                      {services.map((service) => (
                        <li
                          key={service.id}
                          className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line py-2 text-[0.938rem]"
                        >
                          <span className="flex items-center gap-3">
                            <span className="text-orange" aria-hidden="true">
                              ◈
                            </span>
                            {service.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {tags.length > 0 ? (
                  <div className="flex flex-col gap-3.5">
                    <h3 className={blockHead}>Tags</h3>
                    <ul className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <li key={tag.id}>
                          <a
                            className="inline-flex min-h-target items-center border border-zinc-500 px-3.5 text-[0.781rem] text-zinc-700 hover:border-ink hover:text-ink"
                            href={`/projects?tag=${encodeURIComponent(tag.slug)}`}
                          >
                            {tag.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {images.length > 0 ? (
          <section id="gallery" className="border-t border-line bg-zinc-100 py-11 sm:py-14 md:py-18">
            <div className={`${container} flex flex-col gap-7`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
                <div className="flex flex-col gap-3">
                  <p className={eyebrow}>Gallery</p>
                  <h2 className={sectionTitle}>Renders and site photography</h2>
                </div>
                <p className="text-[0.844rem] text-zinc-700">
                  <span className="font-mono">{images.length}</span>{' '}
                  {images.length === 1 ? 'image' : 'images'}
                </p>
              </div>

              <div
                className={
                  galleryOpen
                    ? 'grid grid-cols-2 gap-2 md:grid-cols-4'
                    : 'grid auto-rows-[10rem] grid-cols-2 gap-2 md:auto-rows-[14.375rem] md:grid-cols-[2fr_1fr_1fr]'
                }
              >
                {shownImages.map((url, index) => {
                  const isLastTile = !galleryOpen && index === 4 && images.length > 5;

                  const shape = `${media} relative ${
                    galleryOpen ? 'aspect-[4/3]' : index === 0 ? 'md:row-span-2' : ''
                  }`;

                  // The last tile is a control, not an image, so it carries the
                  // button's own name rather than an img role wrapped round it.
                  return isLastTile ? (
                    <div
                      key={`${url}-${index}`}
                      className={shape}
                      style={{ backgroundImage: cssUrl(url) }}
                    >
                      <button
                        type="button"
                        className="absolute inset-0 flex cursor-pointer items-center justify-center bg-ink-deep/80 text-[0.719rem] font-semibold uppercase tracking-[0.16em] text-white hover:bg-ink-deep/90"
                        onClick={() => setGalleryOpen(true)}
                      >
                        View all {images.length} images
                      </button>
                    </div>
                  ) : (
                    <div
                      key={`${url}-${index}`}
                      className={shape}
                      style={{ backgroundImage: cssUrl(url) }}
                      role="img"
                      aria-label={`${project.title} — image ${index + 1} of ${images.length}`}
                    />
                  );
                })}
              </div>

              {galleryOpen ? (
                <div>
                  <button type="button" className={btnOutline} onClick={() => setGalleryOpen(false)}>
                    Show fewer
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tours.length > 0 ? (
          <section id="tours" className="bg-ink py-11 text-white sm:py-14 md:py-18">
            <div
              className={`${container} grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-14`}
            >
              <div className="flex flex-col gap-5.5 [&_h2_em]:text-orange-on-dark">
                <p className={eyebrowOnDark}>3D virtual tours</p>
                <h2 className={sectionTitle}>
                  Walk the development <em>before it exists</em>.
                </h2>
                <p className="text-[0.969rem] leading-[1.75] text-zinc-200">
                  {tours.length === 1
                    ? 'One tour is available for this development.'
                    : `${tours.length} tours are available for this development.`}{' '}
                  Press Escape or “Exit tour” to return here.
                </p>

                <ul className="flex flex-col gap-2">
                  {tours.map((tour) => {
                    const selected = tour.id === activeTourId;
                    const size = formatBytes(tour.fileSizeBytes);

                    return (
                      <li key={tour.id}>
                        <button
                          type="button"
                          className={`flex w-full min-h-15 cursor-pointer items-center justify-between gap-4 px-4.5 py-2.5 text-left ${
                            selected
                              ? 'bg-white text-ink'
                              : 'border border-line-on-dark text-white hover:border-white'
                          }`}
                          aria-pressed={selected}
                          onClick={() => {
                            setActiveTourId(tour.id);
                            setTourState('idle');
                          }}
                        >
                          <span className="flex flex-col gap-0.75">
                            <span className="text-[0.938rem]">{tour.name}</span>
                            <span
                              className={`font-mono text-[0.688rem] ${
                                selected ? 'text-zinc-700' : 'text-zinc-200'
                              }`}
                            >
                              {TOUR_TYPE_LABEL[tour.type]}
                              {size ? ` · ${size}` : ''}
                            </span>
                          </span>
                          {tour.featured ? (
                            <span className={`${badge} bg-orange text-ink`}>Featured</span>
                          ) : (
                            <span className="text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-orange-on-dark">
                              {selected ? 'Selected' : 'Open'}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {activeTour ? (
                <div ref={viewerRef} className="border border-line-on-dark bg-ink">
                  <div className="flex min-h-13 items-center justify-between gap-3 border-b border-line-on-dark bg-ink-deep pl-4.5">
                    <p className="text-[0.844rem]">{activeTour.name}</p>
                    {tourState === 'open' || tourState === 'loading' ? (
                      <div className="flex">
                        <button
                          type="button"
                          className="min-h-target cursor-pointer px-3.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-white hover:text-orange-on-dark"
                          onClick={() => void viewerRef.current?.requestFullscreen?.()}
                        >
                          Fullscreen
                        </button>
                        <button
                          type="button"
                          className="min-h-target cursor-pointer px-3.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-orange-on-dark hover:text-orange"
                          onClick={exitTour}
                        >
                          Exit tour
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="relative h-62.5 sm:h-80 md:h-100">
                    {tourState === 'open' || tourState === 'loading' ? (
                      <>
                        {/*
                          Sandboxed: a tour is a third-party page whose URL an
                          editor supplies. `allow-same-origin` keeps the frame on
                          the tour's OWN origin — it grants it nothing of ours —
                          which the vendor viewers need for storage and WebGL.
                        */}
                        <iframe
                          className="absolute inset-0 size-full border-0"
                          src={activeTour.embedUrl ?? 'about:blank'}
                          title={`${activeTour.name} — virtual tour`}
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                          allow="fullscreen; xr-spatial-tracking"
                          allowFullScreen
                          referrerPolicy="no-referrer"
                          onLoad={() => setTourState('open')}
                        />
                        {tourState === 'loading' ? (
                          <div
                            className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 bg-ink-deep"
                            aria-live="polite"
                          >
                            <div className="h-1.25 w-40 bg-line-on-dark">
                              <div className="h-full w-1/3 bg-orange" />
                            </div>
                            <p className="text-[0.844rem] text-zinc-200">
                              Loading tour{tourSize ? ` · ${tourSize}` : ''}
                            </p>
                            <button
                              type="button"
                              className="min-h-target cursor-pointer text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-orange-on-dark"
                              onClick={exitTour}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div
                          className={`${media} absolute inset-0`}
                          style={
                            activeTour.thumbnailUrl
                              ? { backgroundImage: cssUrl(activeTour.thumbnailUrl) }
                              : undefined
                          }
                        />
                        <div className="absolute inset-0 bg-ink-deep/45" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 px-6 text-center">
                          {tourState === 'unsupported' ? (
                            <div className="flex max-w-100 flex-col items-center gap-3.5 bg-ink-deep/85 p-6">
                              <p className="text-[1.125rem] font-light">
                                This tour can&rsquo;t be opened here yet.
                              </p>
                              <p className="text-[0.844rem] leading-[1.7] text-zinc-200">
                                {tourSupport(activeTour) === 'model'
                                  ? 'The 3D model needs a viewer this site doesn’t carry yet.'
                                  : 'This tour hasn’t been published in a form this page can open yet.'}{' '}
                                You can still see the development in the gallery, or open another
                                tour.
                              </p>
                              <div className="flex flex-wrap justify-center gap-2.5">
                                {images.length > 0 ? (
                                  <a className={btnWhite} href="#gallery">
                                    View gallery
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  className={btnOutlineOnDark}
                                  onClick={() => setTourState('idle')}
                                >
                                  Back
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                ref={enterTourRef}
                                type="button"
                                className={btnOrange}
                                onClick={() =>
                                  setTourState(
                                    tourSupport(activeTour) === 'embed' ? 'loading' : 'unsupported',
                                  )
                                }
                              >
                                Enter the tour
                              </button>
                              <p className="bg-ink-deep/80 px-2.5 py-1.5 text-[0.781rem]">
                                Best on Wi-Fi{tourSize ? ` · ${tourSize} download` : ''}
                              </p>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/*
          No investment call to action in either state. Unapproved, the band
          says so plainly; approved, the figures are published for information
          and the only action is still to register interest.
        */}
        <section className="bg-line py-11 sm:py-14">
          <div
            className={`${container} grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-13`}
          >
            <div className="flex flex-col gap-4 [&_h2_em]:text-rust">
              <p className={eyebrowOnLine}>Investor information</p>
              {project.investor ? (
                <>
                  <h2 className={sectionTitle}>
                    Indicative <em>project information</em>.
                  </h2>
                  <dl className="grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2">
                    {amount ? (
                      <div className="bg-line p-5">
                        <dt className="text-[0.688rem] uppercase tracking-[0.16em] text-zinc-700">
                          Project value
                        </dt>
                        <dd className="mt-2 font-mono text-[1.5rem] text-ink">{amount}</dd>
                      </div>
                    ) : null}
                    {roi !== null ? (
                      <div className="bg-line p-5">
                        <dt className="text-[0.688rem] uppercase tracking-[0.16em] text-zinc-700">
                          Expected ROI · indicative
                        </dt>
                        <dd className="mt-2 font-mono text-[1.5rem] text-ink">{roi}%</dd>
                      </div>
                    ) : null}
                  </dl>
                  {highlights.length > 0 ? (
                    <ul className="flex flex-col gap-2 pt-1">
                      {highlights.map((line) => (
                        <li
                          key={line}
                          className="flex gap-3 text-[0.938rem] leading-[1.7] text-zinc-700"
                        >
                          <span className="text-rust" aria-hidden="true">
                            ◈
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <>
                  <h2 className={sectionTitle}>
                    Investment details for this project are <em>not published</em>.
                  </h2>
                  <p className="text-[0.969rem] leading-[1.75] text-zinc-700">
                    Register your interest to receive updates on this development and its Project
                    Passport™.
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col items-start gap-5">
              <p className="border-l-3 border-orange pl-4 text-[0.844rem] leading-[1.7] text-zinc-700">
                {project.investor
                  ? 'Figures are indicative and published for information only. They are not an offer. '
                  : ''}
                This is an information request only. CoBuilt Investment Partners does not currently
                offer or solicit investment. An Investor Portal will be introduced once all required
                regulatory approvals and licences are in place.
              </p>
              <a className={`${btnOrange} w-full sm:w-auto`} href="/#register">
                Register your interest
              </a>
            </div>
          </div>
        </section>

        {related.length > 0 ? (
          <section className="bg-white py-11 sm:py-14 md:py-18">
            <div className={`${container} flex flex-col gap-7`}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
                <div className="flex flex-col gap-3">
                  <p className={eyebrow}>
                    {project.location ? `More in ${project.location}` : 'More projects'}
                  </p>
                  <h2 className={sectionTitle}>
                    {project.location ? 'Other developments nearby' : 'Other developments'}
                  </h2>
                </div>
                <a className={btnOutline} href="/projects">
                  All projects
                </a>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {related.map((item) => (
                  <article key={item.id} className="flex flex-col border border-line">
                    {item.featuredImageUrl ? (
                      <div
                        className={`${media} h-42.5`}
                        style={{ backgroundImage: cssUrl(item.featuredImageUrl) }}
                        role="img"
                        aria-label={item.title}
                      />
                    ) : null}
                    <div className="flex flex-1 flex-col gap-2.5 p-5.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[0.656rem] uppercase tracking-[0.16em] text-zinc-600">
                          {item.location ?? 'Location to follow'}
                        </span>
                        <span className={STATUS_CLASS[item.status]}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </div>
                      <h3 className="text-[1.313rem] font-normal tracking-[-0.02em]">
                        <a className="text-ink hover:text-rust" href={`/projects/${item.slug}`}>
                          {item.title}
                        </a>
                      </h3>
                      <div className="mt-auto pt-3">
                        <a className={uppercaseLink} href={`/projects/${item.slug}`}>
                          <span className="sr-only">{item.title} — </span>View →
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </SiteLayout>
  );
}

const MILESTONE_LABEL: Record<string, string> = {
  commencement: 'Commencement',
  foundation: 'Foundation',
  superstructure: 'Superstructure',
  roofing: 'Roofing',
  mep: 'MEP',
  finishes: 'Finishes',
  practical_completion: 'Practical completion',
  handover: 'Handover',
  custom: 'Milestone',
};

/**
 * An editor-supplied tour URL, returned only if it is one this page can frame.
 * A `javascript:` or `data:` URL in an iframe `src` executes in this page's
 * context, which is the same hole `embed_code` is withheld to avoid.
 */
function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const EMPTY: Props = {
  project: null,
  services: [],
  tags: [],
  images: [],
  tours: [],
  passport: null,
  related: [],
};

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, res }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  if (!slug) return { notFound: true };

  // Imported here rather than at the top of the file: everything below reaches
  // PostgreSQL, and Next.js only strips server imports out of the client
  // bundle when they are confined to this function.
  const projectsRepo = await import('@/lib/repositories/projects');
  const toursRepo = await import('@/lib/repositories/tours');
  const passportRepo = await import('@/lib/repositories/passport');
  const { serializeProject, serializeTour, toDateOnly } = await import('@/lib/serializers');

  try {
    const row = await projectsRepo.findBySlug(slug);
    if (!row) return { notFound: true };

    const project = serializeProject(row);

    const [services, tags, albums, tourRows, milestones, nearby] = await Promise.all([
      projectsRepo.labelsByIds('services', project.serviceIds),
      projectsRepo.labelsByIds('tags', project.tagIds),
      projectsRepo.galleryForProject(project.id, project.galleryIds),
      toursRepo.listForProject(project.id),
      row.passport_enabled ? passportRepo.listForProject(project.id) : Promise.resolve([]),
      projectsRepo.listProjects({
        // "More in Lagos" is the index filtered by this project's location, so
        // no related-projects field is needed. One extra row is requested to
        // cover this project being among them.
        ...(row.location_id ? { location: row.location_id } : {}),
        page: 1,
        pageSize: 4,
        sort: 'recent',
      }),
    ]);

    const total = milestones.length;
    const completed = milestones.filter((milestone) => milestone.status === 'completed').length;
    const next = milestones.find((milestone) => milestone.status !== 'completed') ?? null;

    // The record's last entry is when a milestone was last recorded, which is
    // not the same as the date it happened on — the provenance of the record is
    // the point of showing it.
    const lastEntry = milestones.reduce<string | null>((latest, milestone) => {
      const recorded = milestone.triggered_at ? new Date(milestone.triggered_at).toISOString() : null;
      return recorded && (!latest || recorded > latest) ? recorded : latest;
    }, null);

    return {
      props: {
        project: project as Project,
        services,
        tags,
        // Albums are a CMS grouping; the page shows one run of photography.
        images: albums.flatMap((album) => album.imageUrls).filter(Boolean),
        tours: tourRows
          .filter((tour) => tour.processing_status === 'ready')
          .map(serializeTour)
          .map(({ id, name, type, description, thumbnailUrl, tourUrl, fileSizeBytes, featured }) => ({
            id,
            name,
            type,
            description,
            thumbnailUrl,
            // A model's `tourUrl` is the .glb file itself, not a page, so it is
            // never an embed; anything else must be https before it is framed.
            embedUrl: type === 'threejs_model' ? null : httpsUrl(tourUrl),
            fileSizeBytes,
            featured,
          })),
        passport: row.passport_enabled
          ? {
              total,
              completed,
              percent: total === 0 ? 0 : Math.round((completed / total) * 100),
              lastEntry,
              next: next
                ? {
                    label: next.title ?? MILESTONE_LABEL[next.milestone_type] ?? 'Milestone',
                    status: next.status,
                    // Same reason `toDateOnly` reads local parts: a DATE column
                    // is local midnight, and toISOString() would move it a day.
                    scheduledDate: toDateOnly(next.scheduled_date),
                  }
                : null,
            }
          : null,
        related: nearby.results
          .filter((item) => item.id !== project.id)
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.title,
            slug: item.slug,
            status: item.status,
            location: item.location_name ?? null,
            featuredImageUrl: item.featured_image_url,
          })),
      },
    };
  } catch {
    // No database, or it is down. The page still renders and says so, rather
    // than returning a 500 — the same posture the projects index takes.
    res.statusCode = 503;
    return { props: EMPTY };
  }
};
