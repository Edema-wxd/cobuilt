'use client';

import { Fragment, useEffect, useState } from 'react';
import CountUp from '../components/CountUp';
import SiteLayout from '../components/SiteLayout';
import { PHONE, PHONE_HREF, passportHref } from '../components/site';
import HomeVideo from './home-video';
import { cssUrl } from './projects/[slug]/project-shared';
import type { ServiceCard } from './services/load-services';
import { serviceHref } from './services/services';
import {
  cardBody,
  cardTitle,
  field,
  fieldLabel,
  glyph,
  input,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleLg,
  titleMd,
  titleSm,
  uppercaseLink,
} from '../components/sections';
import {
  btnOrange,
  btnOutline,
  btnWhite,
  container,
  eyebrow,
  eyebrowOnDark,
  eyebrowOnLine,
  media,
} from '../components/ui';

/**
 * Public landing page — Direction 3c, the Corporate Digital Standards build.
 *
 * Everything that changes is loaded on the server by app/page.tsx and passed
 * in: the most recently published projects (app/home-projects.ts), the latest
 * news (app/home-news.ts), the leadership spotlight (app/home-leadership.ts),
 * and the administrator's settings from /admin/homepage with the statistics
 * (app/home-settings.ts) — hero copy, the featured video, figure overrides and
 * which optional sections show. The only call from the browser is the
 * "Register your interest" form, which posts to `/api/forms/newsletter`
 * (CSRF-exempt, rate limited, double opt-in). Milestone content here is still
 * illustrative.
 *
 * The page is cut for conversion: every section either builds the case (proof,
 * what we do, how we document it) or asks for the enquiry. The video,
 * leadership and news bands the client's spec asks for sit late and compact,
 * after the case is made, and each one is left out entirely when it has
 * nothing to show — so a fresh database, or none, still renders a clean page.
 * Story and values live on their own pages, reachable from the nav.
 *
 * Two constraints from the brief are deliberate and should survive edits:
 * the page carries no investment call to action — every investor path resolves
 * to "Register your interest" — and the regulatory notice sits beside the form
 * rather than in the footer.
 */

/*
 * Layout values come from the handoff mockup, drawn once at 1160px. Everything
 * below that is mobile-first: base classes are the phone layout, and `sm`,
 * `md` and `lg` add the tablet and desktop layouts back. The page degrades by
 * stacking and by dropping ornament (the hero rail), never by dropping content.
 *
 * The section bands, titles and card classes this page established now live in
 * `components/sections.ts`, shared with the pages built from the same patterns
 * — About, Leadership, Services, Passport™, Media and Contact.
 */
const IMAGES = {
  hero: '/images/hero-aerial-estate.webp',
  villa: '/images/villa-and-pool.webp',
  site: '/images/construction-site.webp',
  apartments: '/images/apartment-blocks.webp',
} as const;

/**
 * Hero carousel slides. Each entry is a still image today; a video slide
 * (an autoplaying, muted `<video>` in place of the background div) drops
 * into this same rotation once footage is ready, so the fade and indicator
 * logic below does not change.
 */
const HERO_SLIDES = [IMAGES.hero, IMAGES.site, IMAGES.villa, IMAGES.apartments] as const;
const HERO_SLIDE_INTERVAL_MS = 6000;

/** One figure in the stat band: counted from live projects, or set by an administrator. */
export interface HomeStat {
  key: string;
  value: number;
  /** Shown as "30+": the figure is a floor, not an exact count. */
  plus: boolean;
  label: string;
}

/** What /admin/homepage controls, resolved on the server (app/home-settings.ts). */
export interface HomeSettings {
  /** Null shows the headline as built. `*phrase*` marks the accent italic. */
  heroHeadline: string | null;
  heroSubheading: string | null;
  /** Null when no video is set or the section is switched off. */
  video: { id: string; title: string } | null;
  /** Figures of 0 are already left out; an empty list hides the band. */
  stats: HomeStat[];
  showNews: boolean;
  showLeadership: boolean;
}

export interface HomeArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  /** Already formatted on the server, e.g. "02 Sep 2026". */
  published: string | null;
  image: string | null;
}

export interface HomeLeader {
  id: string;
  slug: string;
  name: string;
  role: string | null;
  summary: string | null;
  photo: string | null;
}

/** The md column count matches the figures shown, so three figures never leave a gap. */
const STAT_COLUMNS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

/** `press_release` reads as a database value; this is the same thing in English. */
function categoryLabel(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

/** An administrator's headline, with the `*phrase*` they marked set in the accent italic. */
function Accented({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*([^*]+)\*/).map((part, index) =>
        index % 2 === 1 ? <em key={index}>{part}</em> : <Fragment key={index}>{part}</Fragment>,
      )}
    </>
  );
}

type ProjectStatus = 'ongoing' | 'completed' | 'future';

export interface HomeProject {
  id: string;
  slug: string;
  title: string;
  status: ProjectStatus;
  projectType: string | null;
  location: string | null;
  image: string | null;
  passport: boolean;
  completionTarget: string | null;
  progress: { percent: number; stage: string | null } | null;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  future: 'Future',
};

/** What the card's corner link promises, by stage, when it leads to the Passport. */
const LINK_LABEL: Record<ProjectStatus, string> = {
  ongoing: 'Passport →',
  completed: 'Record →',
  future: 'Vision →',
};

const badge =
  'whitespace-nowrap px-2.5 py-1.25 text-[0.625rem] font-bold uppercase tracking-[0.14em]';

const STATUS_CLASS: Record<ProjectStatus, string> = {
  ongoing: `${badge} bg-orange text-ink`,
  completed: `${badge} bg-ink text-white`,
  future: `${badge} bg-line text-ink`,
};

interface Milestone {
  index: string;
  name: string;
  date: string;
  done: boolean;
}

const MILESTONES: Milestone[] = [
  { index: '01', name: 'Land acquired', date: '15 Jan 2026', done: true },
  { index: '02', name: 'Design approved', date: '15 Feb 2026', done: true },
  { index: '03', name: 'Construction started', date: '05 Mar 2026', done: true },
  { index: '04', name: 'Roofing', date: 'Nov 2026', done: false },
];

const STEPS: Array<[string, string, string]> = [
  ['01', 'Enquire', 'Tell us about your site, brief or scheme.'],
  ['02', 'Appraise', 'We assess market, technical and cost feasibility.'],
  ['03', 'Deliver', 'Design and construction against a published programme.'],
  ['04', 'Hand over', 'Completion, documentation and a permanent Passport.'],
];

type FormState = 'idle' | 'sending' | 'done' | 'error';

interface ApiResponse {
  message?: string;
  error?: {
    message?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
}

/**
 * A 5xx carries no message a reader can act on — and outside production it
 * carries the driver's own error — so it is replaced here. A 4xx is the
 * reader's to fix, so the field message is shown as the API worded it.
 */
function describeFailure(status: number, payload: ApiResponse | null): string {
  if (status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (status >= 500) return 'Registrations are unavailable right now. Try again shortly.';
  return (
    payload?.error?.details?.[0]?.message ??
    payload?.error?.message ??
    'Those details were not accepted. Check them and try again.'
  );
}

export default function HomePage({
  projects,
  services,
  news,
  leaders,
  settings,
}: {
  projects: HomeProject[];
  services: ServiceCard[];
  news: HomeArticle[];
  leaders: HomeLeader[];
  settings: HomeSettings;
}) {
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHeroSlide((current) => (current + 1) % HERO_SLIDES.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  async function register(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState('sending');
    setMessage('');

    try {
      const response = await fetch('/api/forms/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName: name,
          source: 'landing:register-interest',
          website,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok) {
        setState('error');
        setMessage(describeFailure(response.status, payload));
        return;
      }

      setState('done');
      setMessage(payload?.message ?? 'Check your inbox to confirm your registration.');
      setName('');
      setEmail('');
    } catch {
      setState('error');
      setMessage('No connection to the server. Check your network and try again.');
    }
  }

  // The optional bands below "How it works" (white) alternate grey and white
  // among those actually shown, so leaving one out never sets two bands of the
  // same ground side by side.
  const optional = [
    settings.video ? 'video' : null,
    leaders.length > 0 ? 'leadership' : null,
    news.length > 0 ? 'news' : null,
  ].filter((name): name is string => name !== null);
  const band = (name: string) => (optional.indexOf(name) % 2 === 0 ? sectionMuted : sectionLight);

  return (
    <SiteLayout current="/" preloadImage={IMAGES.hero}>
      <main id="top">
        <section className="relative isolate flex min-h-screen items-center overflow-hidden bg-line">
          <div
            className="settle absolute inset-0 -z-2"
            role="img"
            aria-label="Rotating photography of CoBuilt developments"
          >
            {/* Each photo drifts slowly back to rest for as long as it is up. */}
            {HERO_SLIDES.map((src, index) => (
              <div
                key={src}
                className={`${media} absolute inset-0 transition-[opacity,scale] duration-[1000ms,7000ms] ease-in-out ${
                  index === heroSlide ? 'scale-100 opacity-100' : 'scale-106 opacity-0'
                }`}
                style={{ backgroundImage: `url('${src}')` }}
                aria-hidden="true"
              />
            ))}
          </div>
          {/* Even on a phone, where the text runs the full width; fading to the right from sm up. */}
          <div
            className="pointer-events-none absolute inset-0 -z-1 bg-[linear-gradient(180deg,rgb(20_20_20/82%)_0%,rgb(20_20_20/90%)_100%)] sm:bg-[linear-gradient(92deg,rgb(20_20_20/93%)_0%,rgb(20_20_20/76%)_46%,rgb(20_20_20/30%)_100%)]"
            aria-hidden="true"
          />

          <div
            className={`${container} grid grid-cols-1 items-center gap-7 pt-11 pb-9 sm:gap-8 sm:py-16 lg:grid-cols-[1fr_280px] lg:gap-10`}
          >
            <div className="intro flex flex-col gap-4.5 text-left sm:gap-6 lg:max-w-170">
              <p className={eyebrowOnDark}>Building Trust Through Every Brick</p>
              <h1 className="text-[length:clamp(2rem,9.5vw,2.5rem)] leading-[1.05] text-white sm:text-[length:clamp(2.25rem,5vw,3.75rem)] sm:leading-[1.02] [&_em]:text-orange-on-dark">
                {settings.heroHeadline ? (
                  <Accented text={settings.heroHeadline} />
                ) : (
                  <>
                    Every family deserves a home that feels like <em>coming home</em>.
                  </>
                )}
              </h1>
              <p className="max-w-135 text-base leading-[1.65] text-zinc-100 sm:text-[1.0625rem] sm:leading-[1.7]">
                {settings.heroSubheading ??
                  'Residential, commercial and mixed-use developments across Nigeria, delivered on a published programme and documented at every milestone.'}
              </p>
              {/* Stacked full width on a phone, so the primary action is never stranded on its own row. */}
              <div className="flex flex-col gap-2.5 pt-1.5 sm:flex-row sm:flex-wrap sm:gap-3 sm:pt-1">
                <a className={btnOrange} href="/contact">
                  Discuss your project
                </a>
                <a className={btnWhite} href="#projects">
                  Explore our projects
                </a>
              </div>
              {/* Live carousel indicators, also the manual controls. */}
              <div className="hidden gap-2 pt-2 sm:flex" role="tablist" aria-label="Hero photos">
                {HERO_SLIDES.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    className={`block h-[3px] w-7 cursor-pointer ${
                      index === heroSlide ? 'bg-orange' : 'bg-white/50'
                    }`}
                    role="tab"
                    aria-selected={index === heroSlide}
                    aria-label={`Show hero photo ${index + 1}`}
                    onClick={() => setHeroSlide(index)}
                  />
                ))}
              </div>
            </div>

            {/*
              Below lg this moves under the actions rather than hiding: tap-to-call matters most
              on a phone. From lg it sits on the light right-hand side of the photo, where the
              scrim is thinnest, so it carries its own dark tile to keep the text above 4.5:1.
            */}
            <div className="intro-self flex flex-col items-start gap-1 border-t border-line-on-dark pt-6 text-left [--step:5] lg:items-end lg:gap-2.25 lg:border-t-0 lg:bg-ink-deep/80 lg:p-5 lg:text-right">
              <span className="text-[0.656rem] uppercase tracking-[0.24em] text-orange-on-dark">
                Call us
              </span>
              <a
                className="inline-flex min-h-target items-center text-[1.1875rem] text-white lg:min-h-0"
                href={PHONE_HREF}
              >
                {PHONE}
              </a>
              <span className="text-[0.781rem] text-zinc-200">Mon–Fri, 08:00–17:00 WAT</span>
            </div>
          </div>
        </section>

        {/* Counted from the published record (or set at /admin/homepage); no band rather than zeros. */}
        {settings.stats.length > 0 ? (
          <section className="bg-orange" aria-label="CoBuilt at a glance">
            <div
              className={`${container} reveal-stagger grid grid-cols-2 gap-x-4 gap-y-6 py-8 sm:gap-7 sm:py-10.5 md:gap-8 ${STAT_COLUMNS[settings.stats.length] ?? 'md:grid-cols-4'}`}
            >
              {settings.stats.map((stat) => (
                <div key={stat.key} className="flex flex-col gap-1.5">
                  <p className="text-[2.25rem] leading-none font-light tracking-[-0.03em] text-ink sm:text-[2.625rem]">
                    <CountUp value={stat.value} />
                    {stat.plus ? <span className="text-[1.5rem]">+</span> : null}
                  </p>
                  <p className="text-[0.688rem] leading-[1.4] tracking-[0.12em] text-ink uppercase sm:leading-[1.6] sm:tracking-[0.18em]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={sectionLight} id="projects">
          <div className={container}>
            <div className={`${sectionHead} mb-7 max-w-150 sm:mb-10`}>
              <p className={eyebrow}>Featured projects</p>
              <h2 className={titleLg}>Delivered, under construction, and planned</h2>
            </div>

            {projects.length === 0 ? (
              <p className="border border-line bg-white p-6 text-[0.938rem] text-zinc-700 sm:p-8">
                Our projects will appear here as each one is published.
              </p>
            ) : (
              <div className="reveal-stagger grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {projects.map((project) => {
                  const href = `/projects/${project.slug}`;
                  const specs = [
                    project.completionTarget ? `Target ${project.completionTarget}` : null,
                  ].filter((spec): spec is string => spec !== null);

                  return (
                    <article
                      key={project.id}
                      className="group flex flex-col border border-line bg-white"
                    >
                      {project.image ? (
                        <div className="overflow-hidden">
                          <div
                            className={`${media} aspect-[16/10] transition-transform duration-700 ease-settle group-hover:scale-104 sm:aspect-auto sm:h-72`}
                            style={{ backgroundImage: `url('${project.image}')` }}
                            role="img"
                            aria-label={`${project.title}${project.location ? `, ${project.location}` : ''}`}
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[16/10] items-end bg-line p-4 sm:aspect-auto sm:h-72">
                          <span className="text-[0.688rem] tracking-[0.16em] text-zinc-600 uppercase">
                            Image to follow
                          </span>
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-3.25 p-5.5 sm:p-6.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[0.656rem] tracking-[0.16em] text-zinc-600 uppercase">
                            {project.projectType ?? ''}
                          </span>
                          <span className={STATUS_CLASS[project.status]}>
                            {STATUS_LABEL[project.status]}
                          </span>
                        </div>
                        <h3 className="text-[1.5rem] font-normal tracking-[-0.02em] text-ink">
                          <a className="hover:text-rust" href={href}>
                            {project.title}
                          </a>
                        </h3>

                        {specs.length > 0 ? (
                          <div className="flex flex-col gap-2 border-t border-line pt-2">
                            {specs.map((spec) => (
                              <p key={spec} className="text-[0.844rem] text-zinc-700">
                                {spec}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        {project.progress ? (
                          <div className="flex flex-col gap-1.75 pt-1.5">
                            <p className="flex justify-between text-[0.75rem] text-ink-mid">
                              <span>{project.progress.stage}</span>
                              <b className="font-semibold">{project.progress.percent}%</b>
                            </p>
                            <div
                              className="h-1.25 overflow-hidden bg-line"
                              role="progressbar"
                              aria-label={`${project.title} programme progress`}
                              aria-valuenow={project.progress.percent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="reveal-bar h-full bg-rust"
                                style={{ width: `${project.progress.percent}%` }}
                              />
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                          <span className="text-[0.656rem] tracking-[0.18em] text-zinc-500 uppercase">
                            {project.location ?? 'Location to follow'}
                          </span>
                          <a
                            className={`${uppercaseLink} -my-3.25 inline-flex min-h-target items-center text-[0.688rem] whitespace-nowrap sm:my-0 sm:inline sm:min-h-0`}
                            href={project.passport ? passportHref(project.slug) : href}
                          >
                            <span className="sr-only">{project.title}: </span>
                            {project.passport ? LINK_LABEL[project.status] : 'Project →'}
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-7 flex flex-col gap-2.5 sm:mt-10 sm:flex-row sm:justify-center sm:gap-3">
              <a className={btnOrange} href="/contact">
                Discuss your project
              </a>
              <a className={btnOutline} href="/projects">
                Explore all projects
              </a>
            </div>
          </div>
        </section>

        {services.length > 0 ? (
          <section className={sectionMuted} id="services">
            <div className={container}>
              <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
                <p className={eyebrow}>Our services</p>
                <h2 className={titleLg}>What we do</h2>
              </div>

              {/*
                Each card draws its own right and bottom rules, so a short last
                row stays white rather than showing the grey ground (the count
                is whatever is published at /admin/services).
              */}
              <div className="reveal grid grid-cols-1 border-t border-l border-zinc-300 sm:grid-cols-2 md:grid-cols-3">
                {services.map((service) => (
                  <article
                    key={service.slug}
                    className={`flex flex-col gap-3 border-r border-b border-zinc-300 p-6 sm:p-8.5 ${service.informational ? 'bg-zinc-50' : 'bg-white'}`}
                  >
                    <span
                      className={`${glyph} ${service.informational ? 'text-zinc-500' : 'text-orange'}`}
                      aria-hidden="true"
                    >
                      ◈
                    </span>
                    <h3 className={`${cardTitle} tracking-[0.16em]`}>{service.title}</h3>
                    <p className={cardBody}>{service.summary}</p>
                    {service.informational ? (
                      <p className="mt-1.5 self-start border border-zinc-400 px-2.5 py-1.5 text-[0.656rem] font-bold tracking-[0.16em] text-zinc-700 uppercase">
                        Informational
                      </p>
                    ) : (
                      <a
                        className={`${uppercaseLink} -mt-1.75 -mb-3.25 inline-flex min-h-target items-center self-start text-[0.719rem] sm:mt-1.5 sm:mb-0 sm:block sm:min-h-0 sm:self-auto`}
                        href={serviceHref(service.slug)}
                      >
                        Learn more →
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section
          className="grid grid-cols-1 bg-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
          id="passport"
        >
          <div
            className={`${media} reveal aspect-[16/10] sm:aspect-auto sm:min-h-100 lg:min-h-160`}
            style={{ backgroundImage: `url('${IMAGES.site}')` }}
            role="img"
            aria-label="Anthony Gardens under construction"
          />
          <div className="reveal flex flex-col gap-5 px-gutter py-11 text-white sm:gap-6 sm:py-14 lg:max-w-180 lg:py-20 [&_h2_em]:text-orange-on-dark">
            <p className={eyebrowOnDark}>Project Passport™ · CB-2024-014</p>
            <h2 className={titleMd}>
              A permanent, public record for every <em>development</em>.
            </h2>
            <p className="max-w-115 text-[0.969rem] leading-[1.75] text-zinc-200">
              Every milestone is published with photos and reports, so you never take progress on
              trust.
            </p>

            <ol className="reveal-stagger flex flex-col">
              {MILESTONES.map((milestone) => (
                <li
                  key={milestone.index}
                  className="flex flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-line-on-dark py-3 last:border-b sm:flex-nowrap sm:py-3.5"
                >
                  <span
                    className={`w-6 flex-none font-mono text-[0.688rem] tracking-[0.14em] ${milestone.done ? 'text-orange-on-dark' : 'text-zinc-400'}`}
                  >
                    {milestone.index}
                  </span>
                  <span
                    className={`flex-1 text-[0.875rem] ${milestone.done ? 'text-white' : 'text-zinc-300'}`}
                  >
                    {milestone.name}
                  </span>
                  {/* On a phone the date drops under the name, so long names keep the full line. */}
                  <span
                    className={`basis-full pl-10 text-[0.781rem] sm:basis-auto sm:pl-0 ${milestone.done ? 'text-zinc-200' : 'text-zinc-400'}`}
                  >
                    {milestone.date}
                    <span className="sr-only">
                      {milestone.done ? ' — recorded' : ' — scheduled'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <a className={`${btnOrange} self-stretch sm:self-start`} href="/passport">
              View Project Passport™
            </a>
          </div>
        </section>

        <section className={sectionLight} aria-labelledby="how-title">
          <div className={container}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-11">
              <div className={sectionHead}>
                <p className={eyebrow}>How it works</p>
                <h2 className={titleMd} id="how-title">
                  Working with CoBuilt
                </h2>
              </div>
              <figure className="reveal flex max-w-115 flex-col gap-2 border-l-3 border-orange pl-4">
                <blockquote className="text-[0.938rem] leading-[1.7] text-zinc-700 italic">
                  “Every query we raised was answered with a document, not an assurance.”
                </blockquote>
                <figcaption className="text-[0.719rem] tracking-[0.14em] text-zinc-500 uppercase">
                  Estate Surveyor · Ridge Terraces
                </figcaption>
              </figure>
            </div>
            <ol className="reveal-stagger mt-8 grid grid-cols-1 gap-7 sm:mt-11 sm:grid-cols-2 sm:gap-x-0 sm:gap-y-9 md:grid-cols-4 md:gap-0">
              {STEPS.map(([number, title, body]) => (
                <li
                  key={number}
                  className="flex flex-col gap-3.25 sm:border-r sm:border-line sm:px-7 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0 sm:max-md:odd:pl-0 sm:max-md:even:border-r-0"
                >
                  <span className="font-mono text-[2rem] leading-none font-light text-rust">
                    {number}
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{title}</h3>
                  <p className={cardBody}>{body}</p>
                </li>
              ))}
            </ol>
            {/* The spec's third primary action; step 01 is exactly this. */}
            <div className="mt-8 flex sm:mt-11">
              <a className={`${btnOrange} w-full sm:w-auto`} href="/contact">
                Contact us
              </a>
            </div>
          </div>
        </section>

        {settings.video ? (
          <section className={band('video')} id="video" aria-labelledby="video-title">
            <div
              className={`${container} grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-11`}
            >
              {/* Beside the player from lg; above it on a phone, so the heading comes first. */}
              <div className={`${sectionHead} lg:order-2`}>
                <p className={eyebrow}>Project video</p>
                <h2 className={titleMd} id="video-title">
                  Watch the work
                </h2>
                <p className={cardBody}>
                  Film from site, from the official CoBuilt YouTube channel. The dated record behind
                  it is in each project&rsquo;s Passport™.
                </p>
              </div>
              <div className="reveal lg:order-1">
                <HomeVideo id={settings.video.id} title={settings.video.title} />
              </div>
            </div>
          </section>
        ) : null}

        {leaders.length > 0 ? (
          <section className={band('leadership')} id="leadership" aria-labelledby="leadership-title">
            <div className={container}>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9 sm:gap-8">
                <div className={`${sectionHead} max-w-150`}>
                  <p className={eyebrow}>Leadership</p>
                  <h2 className={titleMd} id="leadership-title">
                    The people accountable for the record
                  </h2>
                </div>
                <a className={`${btnOutline} w-full sm:w-auto`} href="/leadership">
                  Meet the leadership
                </a>
              </div>

              <div className="reveal-stagger grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3">
                {leaders.map((leader) => (
                  <article
                    key={leader.id}
                    className="flex items-start gap-4 border border-line bg-white p-5 sm:p-6"
                  >
                    {leader.photo ? (
                      <div
                        className={`${media} size-18 flex-none sm:size-20`}
                        style={{ backgroundImage: cssUrl(leader.photo) }}
                        role="img"
                        aria-label={`Portrait of ${leader.name}`}
                      />
                    ) : (
                      // No stock face: the slot says nothing rather than something untrue.
                      <div
                        className="flex size-18 flex-none items-center justify-center bg-line text-[1.25rem] text-zinc-500 sm:size-20"
                        aria-hidden="true"
                      >
                        ◈
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h3 className="text-[1.125rem] leading-[1.3] font-normal text-ink">
                        {leader.name}
                      </h3>
                      {leader.role ? (
                        <p className="text-[0.688rem] tracking-[0.14em] text-zinc-600 uppercase">
                          {leader.role}
                        </p>
                      ) : null}
                      {leader.summary ? (
                        <p className="mt-1 text-[0.844rem] leading-[1.65] text-zinc-600">
                          {leader.summary}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {news.length > 0 ? (
          <section className={band('news')} id="news" aria-labelledby="news-title">
            <div className={container}>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9 sm:gap-8">
                <div className={`${sectionHead} max-w-150`}>
                  <p className={eyebrow}>News &amp; insights</p>
                  <h2 className={titleMd} id="news-title">
                    Latest from CoBuilt
                  </h2>
                </div>
                <a className={`${btnOutline} w-full sm:w-auto`} href="/news">
                  View all news
                </a>
              </div>

              <div className="reveal-stagger grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
                {news.map((article) => (
                  <article key={article.id} className="flex flex-col gap-3">
                    <a className="group flex flex-col gap-3" href={`/news/${article.slug}`}>
                      <div className="overflow-hidden">
                        <div
                          className={`${media} aspect-[16/10] transition-transform duration-700 ease-settle group-hover:scale-104 sm:aspect-auto sm:h-52`}
                          // A missing featured image is ordinary CMS data: the house still, unlabelled.
                          style={{ backgroundImage: cssUrl(article.image ?? IMAGES.apartments) }}
                          {...(article.image
                            ? { role: 'img', 'aria-label': article.title }
                            : { 'aria-hidden': true })}
                        />
                      </div>
                      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.688rem] tracking-[0.16em] text-zinc-600 uppercase">
                        {article.category ? (
                          <span className="text-rust">{categoryLabel(article.category)}</span>
                        ) : null}
                        {article.published ? <span>{article.published}</span> : null}
                      </p>
                      <h3 className="text-[1.1875rem] leading-[1.35] font-normal tracking-normal text-ink group-hover:text-rust">
                        {article.title}
                      </h3>
                    </a>
                    {article.excerpt ? (
                      <p className="line-clamp-3 text-[0.875rem] leading-[1.65] text-zinc-600">
                        {article.excerpt}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="bg-line py-13 sm:py-19" id="register">
          <div
            className={`${container} reveal-stagger grid grid-cols-1 items-center gap-7 sm:gap-9 lg:grid-cols-2 lg:gap-13`}
          >
            <div className="flex flex-col gap-4 [&_h2_em]:text-rust">
              <p className={eyebrowOnLine}>Register your interest</p>
              <h2 className={titleSm}>
                Follow our developments as they <em>progress</em>.
              </h2>
              {/* The regulatory position, which the brief requires on every investor path. */}
              <p className="border-l-3 border-orange pl-4 text-[0.844rem] leading-[1.7] text-zinc-700">
                This is an information request only. CoBuilt Investment Partners does not currently
                offer or solicit investment. An Investor Portal will be introduced once all required
                regulatory approvals and licences are in place.
              </p>
            </div>

            <form
              className="flex flex-col gap-4 border border-zinc-300 bg-white p-5 sm:p-8"
              onSubmit={(event) => {
                void register(event);
              }}
            >
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className={field}>
                  <label className={fieldLabel} htmlFor="name">
                    Full name
                  </label>
                  <input
                    id="name"
                    className={`${input} placeholder:text-zinc-500`}
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className={field}>
                  <label className={fieldLabel} htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    className={`${input} placeholder:text-zinc-500`}
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              {/* Honeypot: scored server-side, never shown to a reader. */}
              <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              <div className="flex items-start gap-2.75 pt-0.5">
                <input
                  className="mt-px size-5 flex-none cursor-pointer accent-orange sm:mt-0.5 sm:size-[17px]"
                  id="consent"
                  type="checkbox"
                  required
                />
                <label
                  className="text-[0.781rem] leading-[1.6] text-zinc-700 [&_a]:text-rust [&_a]:underline"
                  htmlFor="consent"
                >
                  I consent to CoBuilt processing my details in line with the Privacy Policy (NDPA).
                </label>
              </div>

              {/* Charcoal, not white: white on #FF6600 is 2.94:1. */}
              <button
                className="inline-flex min-h-12.5 w-full cursor-pointer items-center justify-center border border-transparent bg-orange px-7 text-center text-[0.719rem] font-semibold tracking-[0.16em] text-ink uppercase transition-colors duration-150 enabled:hover:bg-orange-lift disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={state === 'sending'}
              >
                {state === 'sending' ? 'Sending…' : 'Register your interest'}
              </button>

              {message ? (
                <p
                  className={`text-center text-[0.719rem] font-medium ${state === 'error' ? 'text-msg-bad' : 'text-msg-ok'}`}
                  role="status"
                >
                  {message}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
