'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SiteLayout from '../../../components/SiteLayout';
import ModelViewer from './model-viewer';
import type { ModelFailure, ModelProgress } from './model-viewer';
import { assessDevice, browserHints } from './tour-model';
import { passportHref } from '../../../components/site';
import {
  AccentedTitle,
  MILESTONE_STATUS_CLASS,
  MILESTONE_STATUS_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  badge,
  cssUrl,
  formatDay,
  formatQuarter,
  paragraphs,
} from './project-shared';
import type { MilestoneStatus, Status } from './project-shared';
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
} from '../../../components/ui';

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
  /** The .glb, .gltf or .zip a `threejs_model` loads — https only, vetted the same way. */
  modelUrl: string | null;
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

export interface Project {
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
  /** https only — `load-project` drops anything else before it reaches a link. */
  brochureUrl: string | null;
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

export interface ProjectDetailProps {
  project: Project | null;
  services: Label[];
  tags: Label[];
  images: string[];
  tours: Tour[];
  passport: PassportSummary | null;
  related: RelatedProject[];
}

/**
 * How this page opens a given tour.
 *
 * A `threejs_model` is drawn in the page by `model-viewer.tsx`; a Matterport
 * or custom viewer is a web page, and is framed. A `matterport_embed` may
 * carry only `embed_code`, which is CMS-authored HTML this page will not
 * inject, and so cannot be opened at all.
 */
function tourSupport(tour: Tour): 'embed' | 'model' | 'unavailable' {
  if (tour.type === 'threejs_model') return tour.modelUrl ? 'model' : 'unavailable';
  return tour.embedUrl ? 'embed' : 'unavailable';
}

type TourState = 'idle' | 'caution' | 'loading' | 'open' | 'failed';

/** Why a tour is not showing — each gets its own explanation and way out. */
type TourFailure = 'unavailable' | 'no-webgl' | ModelFailure;

const FAILURE_COPY: Record<TourFailure, { title: string; body: string }> = {
  unavailable: {
    title: 'This tour can’t be opened here yet.',
    body: 'It hasn’t been published in a form this page can open.',
  },
  'no-webgl': {
    title: 'This device can’t show 3D models.',
    body: 'The browser has 3D graphics (WebGL) switched off or doesn’t support them. A recent Chrome, Safari, Firefox or Edge will open it.',
  },
  network: {
    title: 'The model didn’t download.',
    body: 'Either the connection dropped or the file couldn’t be reached. Trying again, ideally on Wi-Fi, usually works.',
  },
  format: {
    title: 'This tour can’t be opened here yet.',
    body: 'The model was published in a format this viewer can’t read.',
  },
  render: {
    title: 'This device ran out of room for the model.',
    body: 'Its graphics memory couldn’t hold a model this size. A laptop or a newer phone will open it.',
  },
};

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

function formatBytes(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / 1_000_000;
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function loadingLabel(tour: Tour, progress: ModelProgress | null): string {
  const size = formatBytes(tour.fileSizeBytes);
  if (tourSupport(tour) !== 'model') return `Loading tour${size ? ` · ${size}` : ''}`;
  if (progress?.phase === 'prepare') return 'Preparing the model…';
  if (progress?.fraction != null) {
    return `Downloading · ${Math.round(progress.fraction * 100)}%${size ? ` of ${size}` : ''}`;
  }
  return `Downloading the model${size ? ` · ${size}` : ''}`;
}

function cautionCopy(reason: 'low-memory' | 'save-data', size: string | null): string {
  const download = size ? `It’s a ${size} download` : 'Its download size isn’t known';
  return reason === 'save-data'
    ? `${download}, and this browser has asked to save data.`
    : `${download}, and this device may struggle to display it.`;
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

export default function ProjectDetail({
  project,
  services,
  tags,
  images,
  tours,
  passport,
  related,
}: ProjectDetailProps) {
  const [activeTourId, setActiveTourId] = useState<string | null>(
    tours.find((tour) => tour.featured)?.id ?? tours[0]?.id ?? null,
  );
  const [tourState, setTourState] = useState<TourState>('idle');
  const [tourFailure, setTourFailure] = useState<TourFailure>('unavailable');
  const [cautionReason, setCautionReason] = useState<'low-memory' | 'save-data'>('low-memory');
  const [modelProgress, setModelProgress] = useState<ModelProgress | null>(null);
  // Bumped by "Try again", so the viewer remounts and downloads afresh.
  const [tourAttempt, setTourAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // Read after mount: the server cannot know, and iPhone Safari says no.
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const enterTourRef = useRef<HTMLButtonElement>(null);

  const activeTour = tours.find((tour) => tour.id === activeTourId) ?? null;
  const viewing = tourState === 'open' || tourState === 'loading';

  const exitTour = useCallback(() => {
    setTourState('idle');
    setModelProgress(null);
    if (document.fullscreenElement) void document.exitFullscreen();
    enterTourRef.current?.focus();
  }, []);

  // A download reports on every chunk; the bar only needs whole percents.
  const trackProgress = useCallback((next: ModelProgress) => {
    setModelProgress((current) =>
      current?.phase === next.phase &&
      (current.fraction === null) === (next.fraction === null) &&
      Math.round((current.fraction ?? 0) * 100) === Math.round((next.fraction ?? 0) * 100)
        ? current
        : next,
    );
  }, []);

  const failTour = useCallback((failure: TourFailure) => {
    setTourFailure(failure);
    setTourState('failed');
    setModelProgress(null);
    if (document.fullscreenElement) void document.exitFullscreen();
  }, []);

  function enterTour(tour: Tour): void {
    const support = tourSupport(tour);
    if (support === 'unavailable') return failTour('unavailable');
    if (support === 'model') {
      // Asked before anything downloads: a device that cannot draw the model,
      // or one that may struggle with its size, is told before it pays for it.
      const verdict = assessDevice(browserHints(), tour.fileSizeBytes);
      if (verdict.kind === 'unsupported') return failTour('no-webgl');
      if (verdict.kind === 'caution') {
        setCautionReason(verdict.reason);
        setTourState('caution');
        return;
      }
    }
    setTourState('loading');
  }

  useEffect(() => {
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const onChange = () => setFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Escape leaves the tour, as the viewer chrome promises it does. In
  // fullscreen the browser takes the first press to leave fullscreen.
  useEffect(() => {
    if (!viewing) return;

    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') exitTour();
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewing, exitTour]);

  if (!project) {
    return (
      <SiteLayout current="/projects">
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
      current="/projects"
      {...(project.featuredImageUrl ? { preloadImage: project.featuredImageUrl } : {})}
    >
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
                {project.brochureUrl ? (
                  <a
                    className={btnOutlineOnDark}
                    href={project.brochureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    Download brochure
                    <span className="sr-only"> for {project.title} (opens in a new tab)</span>
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
            className={`${media} h-72 sm:h-115 md:h-160`}
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
                <a className={uppercaseLink} href={passportLink}>
                  <span className="sr-only">{project.title} — </span>Open the full record →
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
                    : 'grid auto-rows-[12.5rem] grid-cols-2 gap-2 md:auto-rows-[18rem] md:grid-cols-[2fr_1fr_1fr]'
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
                            setModelProgress(null);
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
                <div
                  ref={viewerRef}
                  className={`flex flex-col border border-line-on-dark bg-ink ${fullscreen ? 'h-full' : ''}`}
                >
                  <div className="flex min-h-13 items-center justify-between gap-3 border-b border-line-on-dark bg-ink-deep pl-4.5">
                    <p className="text-[0.844rem]">{activeTour.name}</p>
                    {viewing ? (
                      <div className="flex">
                        {canFullscreen ? (
                          <button
                            type="button"
                            className="min-h-target cursor-pointer px-2.5 text-[0.688rem] font-semibold whitespace-nowrap uppercase tracking-[0.14em] sm:px-3.5 text-white hover:text-orange-on-dark"
                            onClick={() =>
                              void (fullscreen
                                ? document.exitFullscreen()
                                : viewerRef.current?.requestFullscreen())
                            }
                          >
                            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="min-h-target cursor-pointer px-2.5 text-[0.688rem] font-semibold whitespace-nowrap uppercase tracking-[0.14em] sm:px-3.5 text-orange-on-dark hover:text-orange"
                          onClick={exitTour}
                        >
                          Exit tour
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`relative ${fullscreen ? 'min-h-0 flex-1' : 'h-62.5 sm:h-80 md:h-100'}`}
                  >
                    {viewing ? (
                      <>
                        {tourSupport(activeTour) === 'model' && activeTour.modelUrl ? (
                          <ModelViewer
                            key={`${activeTour.id}-${tourAttempt}`}
                            url={activeTour.modelUrl}
                            name={activeTour.name}
                            expectedBytes={activeTour.fileSizeBytes}
                            onProgress={trackProgress}
                            onReady={() => {
                              setModelProgress(null);
                              setTourState('open');
                            }}
                            onError={failTour}
                          />
                        ) : (
                          /*
                            Sandboxed: a tour is a third-party page whose URL an
                            editor supplies. `allow-same-origin` keeps the frame on
                            the tour's OWN origin — it grants it nothing of ours —
                            which the vendor viewers need for storage and WebGL.
                          */
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
                        )}
                        {tourState === 'loading' ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 bg-ink-deep px-6 text-center">
                            <div
                              className="h-1.25 w-40 bg-line-on-dark sm:w-56"
                              role="progressbar"
                              aria-label={`Loading ${activeTour.name}`}
                              {...(modelProgress?.fraction != null
                                ? { 'aria-valuenow': Math.round(modelProgress.fraction * 100) }
                                : {})}
                            >
                              <div
                                className={`h-full bg-orange ${
                                  modelProgress?.fraction != null ? '' : 'w-1/3 motion-safe:animate-pulse'
                                }`}
                                style={
                                  modelProgress?.fraction != null
                                    ? { width: `${modelProgress.fraction * 100}%` }
                                    : undefined
                                }
                              />
                            </div>
                            <p className="font-mono text-[0.781rem] text-zinc-200">
                              {loadingLabel(activeTour, modelProgress)}
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 overflow-y-auto px-6 text-center">
                          {tourState === 'failed' || tourState === 'caution' ? (
                            <div
                              className="flex max-w-100 flex-col items-center gap-3.5 bg-ink-deep/85 p-6"
                              role={tourState === 'failed' ? 'alert' : 'status'}
                            >
                              <p className="text-[1.125rem] font-light">
                                {tourState === 'failed'
                                  ? FAILURE_COPY[tourFailure].title
                                  : 'This is a large model.'}
                              </p>
                              <p className="text-[0.844rem] leading-[1.7] text-zinc-200">
                                {tourState === 'failed'
                                  ? FAILURE_COPY[tourFailure].body
                                  : cautionCopy(cautionReason, tourSize)}{' '}
                                {images.length === 0
                                  ? ''
                                  : tourState === 'caution'
                                    ? 'The gallery shows the development without the wait.'
                                    : 'You can still see the development in the gallery.'}
                              </p>
                              <div className="flex flex-wrap justify-center gap-2.5">
                                {tourState === 'caution' ? (
                                  <button
                                    type="button"
                                    className={btnOrange}
                                    onClick={() => setTourState('loading')}
                                  >
                                    Load anyway
                                  </button>
                                ) : null}
                                {tourState === 'failed' && tourFailure === 'network' ? (
                                  <button
                                    type="button"
                                    className={btnOrange}
                                    onClick={() => {
                                      setTourAttempt((value) => value + 1);
                                      setTourState('loading');
                                    }}
                                  >
                                    Try again
                                  </button>
                                ) : null}
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
                                onClick={() => enterTour(activeTour)}
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
                        className={`${media} h-56`}
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