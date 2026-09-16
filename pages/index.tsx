import { Fragment, useState } from 'react';
import SiteLayout from '../components/SiteLayout';
import { PHONE, PHONE_HREF } from '../components/site';
import {
  btnOrange,
  btnOutline,
  btnOutlineOnDark,
  btnWhite,
  container,
  eyebrow,
  eyebrowOnDark,
  media,
} from '../components/ui';

/**
 * Public landing page — Direction 3c, the Corporate Digital Standards build.
 *
 * Deliberately static: the page renders without PostgreSQL, so `npm run dev`
 * works on a fresh checkout. The only live call is the "Register your interest"
 * form, which posts to `/api/forms/newsletter` (CSRF-exempt, rate limited,
 * double opt-in). Project, news and milestone content here is illustrative and
 * is replaced by CMS-backed content when the inner pages are built.
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
 * stacking and by dropping ornament (the hero rail, the marquee), never by
 * dropping content.
 */
const section = 'py-13 sm:py-16 md:py-22';
const sectionLight = `${section} bg-white`;
const sectionMuted = `${section} border-t border-line bg-zinc-100`;
const sectionHead = 'flex flex-col gap-3.5';

const titleLg = 'text-[length:clamp(1.875rem,3.4vw,2.75rem)]';
const titleMd = 'text-[length:clamp(1.75rem,3vw,2.5rem)]';
const titleSm = 'text-[length:clamp(1.5rem,2.4vw,2.125rem)]';

const glyph = 'text-[1.25rem] leading-none';
const cardTitle = 'text-[0.781rem] font-semibold uppercase text-ink';
const cardBody = 'text-[0.906rem] leading-[1.7] text-zinc-600';
const uppercaseLink = 'font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover';

const field = 'flex flex-col gap-1.75';
const fieldLabel = 'text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-zinc-700';
/** 16px on a phone: below that, iOS Safari zooms the page when a field takes focus. */
const input =
  'min-h-12 w-full rounded-none border border-zinc-400 bg-white px-3.5 text-base text-ink sm:min-h-11.5 sm:text-[0.875rem]';

const IMAGES = {
  hero: '/images/hero-aerial-estate.webp',
  villa: '/images/villa-and-pool.webp',
  site: '/images/construction-site.webp',
  apartments: '/images/apartment-blocks.webp',
} as const;

const STATS: Array<{ value: string; plus?: boolean; label: string }> = [
  { value: '5', plus: true, label: 'Projects delivered' },
  { value: '3', label: 'Projects under development' },
  { value: '30', plus: true, label: 'Units developed' },
  { value: '5', plus: true, label: 'Locations' },
];

const SERVICES: Array<{
  title: string;
  body: string;
  informational?: boolean;
}> = [
  {
    title: 'Real Estate Development',
    body: 'High-quality residential, commercial, mixed-use and strategic developments.',
  },
  {
    title: 'Construction Management',
    body: 'Project execution focused on quality craftsmanship, cost efficiency, safety and timely delivery.',
  },
  {
    title: 'Development Management',
    body: 'Every stage from concept to completion, coordinated efficiently and professionally.',
  },
  {
    title: 'Project Advisory',
    body: 'Feasibility studies, commercial assessment, procurement planning and development strategy.',
  },
  {
    title: 'Asset & Property Management',
    body: 'Preserving and enhancing the long-term value of completed developments.',
  },
  {
    title: 'Property Investment',
    body: 'Information only. No investment is offered or solicited pending regulatory licensing.',
    informational: true,
  },
];

type ProjectStatus = 'ongoing' | 'completed' | 'future';

interface Project {
  id: string;
  status: ProjectStatus;
  statusLabel: string;
  title: string;
  tagline: string;
  specs: string[];
  progress?: { stage: string; percent: number };
  place: string;
  linkLabel: string;
  image: string;
}

const PROJECTS: Project[] = [
  {
    id: 'CB-2024-014',
    status: 'ongoing',
    statusLabel: 'Ongoing',
    title: 'Anthony Gardens',
    tagline: 'Eighty-four homes, built in the open.',
    specs: ['3 & 4 bedroom apartments', 'Duplex penthouses'],
    progress: { stage: 'Superstructure', percent: 68 },
    place: 'Ikoyi, Lagos',
    linkLabel: 'Passport →',
    image: IMAGES.site,
  },
  {
    id: 'CB-2021-008',
    status: 'completed',
    statusLabel: 'Completed',
    title: 'Ridge Terraces',
    tagline: 'Handed over on the published date.',
    specs: ['32 terraced homes', 'Handover September 2025', 'Full milestone archive'],
    place: 'Independence Layout, Enugu',
    linkLabel: 'Profile →',
    image: IMAGES.hero,
  },
  {
    id: 'CB-2027-021',
    status: 'future',
    statusLabel: 'Future',
    title: 'TechZone Quarter',
    tagline: 'Where the working city meets home.',
    specs: ['Mixed-use, design development', 'Groundbreak 2027', 'Programme 2027–29'],
    place: 'Wuse 2, Abuja',
    linkLabel: 'Vision →',
    image: IMAGES.apartments,
  },
];

const badge =
  'whitespace-nowrap px-2.5 py-1.25 text-[0.625rem] font-bold uppercase tracking-[0.14em]';

const STATUS_CLASS: Record<ProjectStatus, string> = {
  ongoing: `${badge} bg-orange text-ink`,
  completed: `${badge} bg-ink text-white`,
  future: `${badge} bg-line text-ink`,
};

type Filter = 'all' | ProjectStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Past' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'future', label: 'Future' },
];

interface Milestone {
  index: string;
  name: string;
  date: string;
  done: boolean;
}

const MILESTONES: Milestone[] = [
  { index: '01', name: 'Land acquired', date: '15 Jan 2026', done: true },
  { index: '02', name: 'Design approved', date: '15 Feb 2026', done: true },
  {
    index: '03',
    name: 'Construction started',
    date: '05 Mar 2026',
    done: true,
  },
  { index: '04', name: 'Roofing', date: 'Nov 2026', done: false },
  {
    index: '05',
    name: 'Building services installation',
    date: 'Feb 2027',
    done: false,
  },
];

const VALUES: Array<[string, string]> = [
  [
    'Integrity',
    'We conduct our business honestly, ethically and transparently in every decision and commitment.',
  ],
  [
    'Excellence',
    'We pursue the highest standards of professionalism, quality and continuous improvement.',
  ],
  [
    'Innovation',
    'We embrace technology and forward-thinking solutions that create smarter developments.',
  ],
  [
    'Sustainability',
    'We balance economic success with environmental stewardship and social responsibility.',
  ],
];

const STEPS: Array<[string, string, string]> = [
  ['01', 'Enquire', 'Tell us about the site, brief or scheme you have in mind.'],
  [
    '02',
    'Appraise',
    'We prepare a feasibility appraisal covering market, technical and cost position.',
  ],
  ['03', 'Deliver', 'Design, procurement and construction managed against a published programme.'],
  ['04', 'Hand over', 'Practical completion, documentation and a permanent Passport archive.'],
];

const NEWS: Array<{
  category: string;
  date: string;
  title: string;
  excerpt: string;
  image: string;
}> = [
  {
    category: 'Project update',
    date: '02 Sep 2026',
    title: 'Anthony Gardens reaches sixth-floor slab',
    excerpt: 'Superstructure works remain on programme ahead of roofing in November.',
    image: IMAGES.site,
  },
  {
    category: 'Thought leadership',
    date: '21 Aug 2026',
    title: 'What verified milestone reporting changes for Nigerian development',
    excerpt: 'A practical view on documentation standards and stakeholder trust.',
    image: IMAGES.apartments,
  },
  {
    category: 'Announcement',
    date: '04 Aug 2026',
    title: 'CoBuilt publishes 2026 sustainability commitments',
    excerpt: 'Targets covering materials, energy and community engagement.',
    image: IMAGES.villa,
  },
];

const ENQUIRER_TYPES = [
  'Prospective client',
  'Prospective partner',
  'Supplier or contractor',
  'Media enquiry',
  'Other',
] as const;

const MARQUEE_PHRASES = ['CoBuilt Investment Partners', 'Building Trust Through Every Brick'];

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

export default function Home() {
  const [filter, setFilter] = useState<Filter>('all');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enquirerType, setEnquirerType] = useState<string>(ENQUIRER_TYPES[0]);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  const visibleProjects =
    filter === 'all' ? PROJECTS : PROJECTS.filter((project) => project.status === filter);

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
          source: `landing:register-interest:${enquirerType}`.slice(0, 100),
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

  return (
    <SiteLayout
      title="CoBuilt Investment Partners — Building Trust Through Every Brick"
      description="CoBuilt Investment Partners delivers high-quality residential, commercial, mixed-use and strategic developments in Nigeria. Every project carries a Project Passport — a permanent, public record from commencement to handover."
      current="/"
      preloadImage={IMAGES.hero}
    >
      <main id="top">
        <section className="relative isolate flex items-center bg-line sm:min-h-135">
          <div
            className={`${media} absolute inset-0 -z-2`}
            style={{ backgroundImage: `url('${IMAGES.hero}')` }}
            role="img"
            aria-label="Aerial view of a CoBuilt residential estate"
          />
          {/* Even on a phone, where the text runs the full width; fading to the right from sm up. */}
          <div
            className="pointer-events-none absolute inset-0 -z-1 bg-[linear-gradient(180deg,rgb(20_20_20/82%)_0%,rgb(20_20_20/90%)_100%)] sm:bg-[linear-gradient(92deg,rgb(20_20_20/93%)_0%,rgb(20_20_20/76%)_46%,rgb(20_20_20/30%)_100%)]"
            aria-hidden="true"
          />

          <div
            className={`${container} grid grid-cols-1 items-center gap-7 pt-11 pb-9 sm:gap-8 sm:py-16 lg:grid-cols-[52px_1fr_280px] lg:gap-10`}
          >
            <div className="hidden flex-col items-center gap-4.5 lg:flex" aria-hidden="true">
              <span className="block h-12 w-px bg-white/30" />
              <span className="text-[0.625rem] uppercase tracking-[0.24em] text-zinc-200 [writing-mode:vertical-rl]">
                Follow us
              </span>
              <span className="block h-12 w-px bg-white/30" />
            </div>

            <div className="flex flex-col gap-4.5 sm:gap-6">
              <p className={eyebrowOnDark}>Building Trust Through Every Brick</p>
              <h1 className="text-[length:clamp(2rem,9.5vw,2.5rem)] leading-[1.05] text-white sm:text-[length:clamp(2.25rem,5vw,3.75rem)] sm:leading-[1.02] [&_em]:text-orange-on-dark">
                Creating sustainable developments. Delivering <em>lasting value</em>.
              </h1>
              <p className="max-w-135 text-base leading-[1.65] text-zinc-100 sm:text-[1.0625rem] sm:leading-[1.7]">
                CoBuilt Investment Partners delivers high-quality residential, commercial, mixed-use
                and strategic developments that create lasting value for investors, businesses and
                communities.
              </p>
              {/* Stacked full width on a phone, so the primary action is never stranded on its own row. */}
              <div className="flex flex-col gap-2.5 pt-1.5 sm:flex-row sm:flex-wrap sm:gap-3 sm:pt-1">
                <a className={btnOrange} href="#register">
                  Discuss your project
                </a>
                <a className={btnWhite} href="#projects">
                  Explore our projects
                </a>
                <a className={btnOutlineOnDark} href="#register">
                  Contact us
                </a>
              </div>
              {/* Carousel indicators with no carousel behind them; on a phone they only cost height. */}
              <div className="hidden gap-2 pt-2 sm:flex" aria-hidden="true">
                <span className="block h-[3px] w-7 bg-orange" />
                <span className="block h-[3px] w-7 bg-white/50" />
                <span className="block h-[3px] w-7 bg-white/50" />
              </div>
            </div>

            {/*
              Below lg this moves under the actions rather than hiding: tap-to-call matters most
              on a phone. From lg it sits on the light right-hand side of the photo, where the
              scrim is thinnest, so it carries its own dark tile to keep the text above 4.5:1.
            */}
            <div className="flex flex-col items-start gap-1 border-t border-line-on-dark pt-6 text-left lg:items-end lg:gap-2.25 lg:border-t-0 lg:bg-ink-deep/80 lg:p-5 lg:text-right">
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

        <section className="bg-orange" aria-label="CoBuilt at a glance">
          <div
            className={`${container} grid grid-cols-2 gap-x-4 gap-y-6 py-8 sm:gap-7 sm:py-10.5 md:grid-cols-4 md:gap-8`}
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1.5">
                <p className="text-[2.25rem] leading-none font-light tracking-[-0.03em] text-ink sm:text-[2.625rem]">
                  {stat.value}
                  {stat.plus ? <span className="text-[1.5rem]">+</span> : null}
                </p>
                <p className="text-[0.688rem] leading-[1.4] tracking-[0.12em] text-ink uppercase sm:leading-[1.6] sm:tracking-[0.18em]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={sectionLight} id="about">
          <div
            className={`${container} grid grid-cols-1 items-center gap-7 sm:gap-9 md:grid-cols-2 md:gap-16`}
          >
            <div className="flex flex-col gap-5 [&_h2_em]:text-rust">
              <p className={eyebrow}>About CoBuilt</p>
              <h2 className={titleLg}>
                A development company built on <em>documented</em> delivery.
              </h2>
              <p className="text-base leading-[1.8] text-zinc-700">
                CoBuilt Investment Partners plans, manages and delivers residential, commercial,
                mixed-use and strategic developments. Our integrated model spans land acquisition,
                feasibility, planning, financing, development management, construction oversight,
                sales and asset management.
              </p>
              <p className="text-base leading-[1.8] text-zinc-600">
                That record is Project Passport™ — a permanent, public account of each development,
                from commencement through to handover.
              </p>
              <a
                className="mt-2 inline-flex min-h-target items-center self-start border-b border-orange text-[0.719rem] font-semibold tracking-[0.16em] text-rust uppercase hover:text-rust-hover sm:block sm:min-h-0 sm:pb-2"
                href="#passport"
              >
                Read our story
              </a>
            </div>
            <div
              className={`${media} aspect-[4/3] sm:aspect-auto sm:h-80 md:h-115`}
              style={{ backgroundImage: `url('${IMAGES.villa}')` }}
              role="img"
              aria-label="A completed CoBuilt villa and pool"
            />
          </div>
        </section>

        <section className={sectionMuted} id="services">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>Our services</p>
              <h2 className={titleLg}>What we do</h2>
              <p className="text-base leading-[1.75] text-zinc-700">
                Six disciplines delivered under one governance framework — from feasibility through
                to practical completion and handover.
              </p>
            </div>

            {/* The 1px gap over a grey ground draws the rules between cards. */}
            <div className="grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2 md:grid-cols-3">
              {SERVICES.map((service) => (
                <article
                  key={service.title}
                  className={`flex flex-col gap-3 p-6 sm:p-8.5 ${service.informational ? 'bg-zinc-50' : 'bg-white'}`}
                >
                  <span
                    className={`${glyph} ${service.informational ? 'text-zinc-500' : 'text-orange'}`}
                    aria-hidden="true"
                  >
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{service.title}</h3>
                  <p className={cardBody}>{service.body}</p>
                  {service.informational ? (
                    <p className="mt-1.5 self-start border border-zinc-400 px-2.5 py-1.5 text-[0.656rem] font-bold tracking-[0.16em] text-zinc-700 uppercase">
                      Informational
                    </p>
                  ) : (
                    <a
                      className={`${uppercaseLink} -mt-1.75 -mb-3.25 inline-flex min-h-target items-center self-start text-[0.719rem] sm:mt-1.5 sm:mb-0 sm:block sm:min-h-0 sm:self-auto`}
                      href="#register"
                    >
                      Learn more →
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionLight} id="projects">
          <div className={container}>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-10 sm:gap-8">
              <div className={`${sectionHead} max-w-150`}>
                <p className={eyebrow}>Featured projects</p>
                <h2 className={titleLg}>Delivered, under construction, and planned</h2>
              </div>
              {/* One scrolling row on a phone, bled to the screen edge, rather than two wrapped rows. */}
              <div
                className="-mx-gutter flex w-[calc(100%+2*var(--spacing-gutter))] flex-none gap-2 overflow-x-auto px-gutter py-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:p-0 [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Filter projects by stage"
              >
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`inline-flex min-h-target flex-none cursor-pointer items-center border px-4.5 text-[0.688rem] font-semibold tracking-[0.14em] uppercase ${
                      filter === option.value
                        ? 'border-ink bg-ink text-white'
                        : 'border-zinc-300 bg-white text-ink hover:border-ink'
                    }`}
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {visibleProjects.map((project) => (
                <article key={project.id} className="flex flex-col border border-line bg-white">
                  <div
                    className={`${media} aspect-[16/10] sm:aspect-auto sm:h-57.5`}
                    style={{ backgroundImage: `url('${project.image}')` }}
                    role="img"
                    aria-label={`${project.title}, ${project.place}`}
                  />
                  <div className="flex flex-1 flex-col gap-3.25 p-5.5 sm:p-6.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[0.656rem] tracking-[0.16em] text-zinc-600 uppercase">
                        {project.id}
                      </span>
                      <span className={STATUS_CLASS[project.status]}>{project.statusLabel}</span>
                    </div>
                    <h3 className="text-[1.5rem] font-normal tracking-[-0.02em] text-ink">
                      {project.title}
                    </h3>
                    <p className="text-[0.906rem] leading-[1.55] text-zinc-600 italic">
                      {project.tagline}
                    </p>

                    <div className="flex flex-col gap-2 border-t border-line pt-2">
                      {project.specs.map((spec) => (
                        <p key={spec} className="text-[0.844rem] text-zinc-700">
                          {spec}
                        </p>
                      ))}
                    </div>

                    {project.progress ? (
                      <div className="flex flex-col gap-1.75 pt-1.5">
                        <p className="flex justify-between text-[0.75rem] text-ink-mid">
                          <span>{project.progress.stage}</span>
                          <b className="font-semibold">{project.progress.percent}%</b>
                        </p>
                        <div
                          className="h-1.25 overflow-hidden bg-line"
                          role="progressbar"
                          aria-label={`${project.title} ${project.progress.stage} progress`}
                          aria-valuenow={project.progress.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full bg-rust"
                            style={{ width: `${project.progress.percent}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span className="text-[0.656rem] tracking-[0.18em] text-zinc-500 uppercase">
                        {project.place}
                      </span>
                      <a
                        className={`${uppercaseLink} -my-3.25 inline-flex min-h-target items-center text-[0.688rem] whitespace-nowrap sm:my-0 sm:inline sm:min-h-0`}
                        href="#passport"
                      >
                        {project.linkLabel}
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-7 flex justify-center sm:mt-10">
              <a className={`${btnOutline} w-full sm:w-auto`} href="#register">
                Explore all projects
              </a>
            </div>
          </div>
        </section>

        <section
          className="grid grid-cols-1 bg-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
          id="passport"
        >
          <div
            className={`${media} aspect-[16/10] sm:aspect-auto sm:min-h-80 lg:min-h-130`}
            style={{ backgroundImage: `url('${IMAGES.site}')` }}
            role="img"
            aria-label="Anthony Gardens under construction"
          />
          <div className="flex flex-col gap-5 px-gutter py-11 text-white sm:gap-6 sm:py-14 lg:max-w-180 lg:py-20 [&_h2_em]:text-orange-on-dark">
            <p className={eyebrowOnDark}>Project Passport™ · CB-2024-014</p>
            <h2 className={titleMd}>
              A permanent, public record for every <em>development</em>.
            </h2>
            <p className="max-w-115 text-[0.969rem] leading-[1.75] text-zinc-200">
              Each project carries a unique Project ID and a passport updated at every mandatory
              milestone, with site photography, progress reports, project team and sustainability
              features attached.
            </p>

            <ol className="flex flex-col">
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

            <a className={`${btnOrange} self-stretch sm:self-start`} href="#register">
              View Project Passport™
            </a>
          </div>
        </section>

        <section className={sectionLight} aria-labelledby="values-title">
          <div className={container}>
            <div className="mb-8 flex flex-col items-start gap-3 text-left sm:mb-12 sm:items-center sm:text-center">
              <p className={eyebrow}>Our values</p>
              <h2 className={titleMd} id="values-title">
                Where standards meet trusted professionals
              </h2>
            </div>
            {/* Vertical rules only read correctly on a single row, so the two-column layout drops every second one. */}
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-x-0 sm:gap-y-9 md:grid-cols-4 md:gap-0">
              {VALUES.map(([title, body]) => (
                <div
                  key={title}
                  className="flex flex-col items-start gap-3.25 text-left sm:items-center sm:border-r sm:border-line sm:px-7 sm:text-center sm:max-md:even:border-r-0 md:last:border-r-0"
                >
                  <span className={`${glyph} text-orange`} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.18em]`}>{title}</h3>
                  <p className={cardBody}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionMuted} id="leadership">
          <div
            className={`${container} grid grid-cols-1 items-start gap-9 lg:grid-cols-[1.35fr_1fr] lg:gap-11`}
          >
            <div className="flex flex-col gap-5">
              <p className={eyebrow}>Video library</p>
              <h2 className={titleSm}>Watch the work</h2>
              {/* A still preview, not a player: the embed is wired up when the video ID
                  exists, so nothing here advertises a control that does not work yet. */}
              <figure className="relative block aspect-[16/10] w-full overflow-hidden bg-ink sm:aspect-auto sm:h-82.5">
                <div
                  className={`${media} absolute inset-0`}
                  style={{ backgroundImage: `url('${IMAGES.site}')` }}
                />
                <span
                  className="absolute inset-0 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="flex size-16 items-center justify-center rounded-full border-[1.5px] border-white bg-[rgb(20_20_20/86%)] text-[1.125rem] text-white">
                    ▶
                  </span>
                </span>
                {/* Solid for the lower half so the kicker never lands on bright sky. */}
                <figcaption className="absolute inset-x-0 bottom-0 flex flex-col bg-[linear-gradient(0deg,rgb(20_20_20/92%)_55%,rgb(20_20_20/0%))] px-4 pt-12 pb-4 text-white sm:px-5.5 sm:pt-14 sm:pb-5.5">
                  <span className="text-[0.656rem] tracking-[0.18em] text-orange-on-dark uppercase">
                    Project documentary · 6:42
                  </span>
                  <span className="mt-1.5 text-[1.0625rem] font-normal sm:text-[1.25rem]">
                    Anthony Gardens: one year on site
                  </span>
                </figcaption>
              </figure>
              <p className="text-[0.781rem] text-zinc-600">
                Embedded from the official CoBuilt YouTube channel. Captions available.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <p className={eyebrow}>Leadership</p>
              <article className="border border-line bg-white">
                <div className="flex h-45 items-start bg-line p-3.5 text-[0.719rem] text-zinc-600 sm:h-52.5">
                  Managing Director — approved portrait
                </div>
                <div className="flex flex-col gap-3.25 p-5.5 sm:p-6.5">
                  <div>
                    <p className="text-[1.25rem] font-normal text-ink">Managing Director</p>
                    <p className="mt-1.25 text-[0.719rem] tracking-[0.14em] text-zinc-500 uppercase">
                      CoBuilt Investment Partners
                    </p>
                  </div>
                  <p className="text-[0.938rem] leading-[1.7] text-zinc-700 italic">
                    “Transparency is not a marketing exercise. It is a delivery discipline — and it
                    is how we intend to be measured.”
                  </p>
                  <a
                    className={`${uppercaseLink} -my-3.25 inline-flex min-h-target items-center self-start text-[0.719rem] sm:my-0 sm:block sm:min-h-0 sm:self-auto`}
                    href="#about"
                  >
                    Leadership philosophy →
                  </a>
                </div>
              </article>

              <figure className="flex flex-col gap-3.5 border border-line bg-white p-5.5 sm:p-6.5">
                <span className={`${glyph} text-orange`} aria-hidden="true">
                  ◈
                </span>
                <blockquote className="text-[0.938rem] leading-[1.7] text-zinc-700">
                  “Every query we raised was answered with a document, not an assurance.”
                </blockquote>
                <figcaption className="border-t border-line pt-2">
                  <p className="text-[0.906rem] text-ink">Estate Surveyor</p>
                  <p className="mt-1 text-[0.719rem] tracking-[0.14em] text-zinc-500 uppercase">
                    Ridge Terraces
                  </p>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className={sectionLight} aria-labelledby="how-title">
          <div className={container}>
            <div className={sectionHead}>
              <p className={eyebrow}>How it works</p>
              <h2 className={titleMd} id="how-title">
                Working with CoBuilt
              </h2>
            </div>
            <ol className="mt-8 grid grid-cols-1 gap-7 sm:mt-11 sm:grid-cols-2 sm:gap-x-0 sm:gap-y-9 md:grid-cols-4 md:gap-0">
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
          </div>
        </section>

        {/* A 28px wordmark scrolling past on a phone is noise, not texture, so it starts at sm. */}
        <div
          className="hidden overflow-hidden border-y border-line bg-white py-6 sm:block"
          aria-hidden="true"
        >
          <div className="flex w-max animate-marquee items-center gap-14">
            {/* Rendered twice: the -50% translation relies on an exact duplicate. */}
            {[0, 1].map((copy) =>
              MARQUEE_PHRASES.map((phrase) => (
                <Fragment key={`${copy}-${phrase}`}>
                  <span className="text-[1.75rem] font-light tracking-[0.14em] whitespace-nowrap text-line uppercase">
                    {phrase}
                  </span>
                  <span className="text-[1.75rem] text-orange">◈</span>
                </Fragment>
              )),
            )}
          </div>
        </div>

        <section className={sectionLight} id="media">
          <div className={container}>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9 sm:gap-8">
              <div className={`${sectionHead} max-w-150`}>
                <p className={eyebrow}>Media centre</p>
                <h2 className={titleMd}>Keep up with company updates in one place</h2>
              </div>
              <a className={btnOutline} href="#register">
                More news
              </a>
            </div>

            <div className="grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
              {NEWS.map((item) => (
                <article key={item.title} className="flex flex-col gap-3.5">
                  <div
                    className={`${media} aspect-[16/10] sm:aspect-auto sm:h-50`}
                    style={{ backgroundImage: `url('${item.image}')` }}
                    role="img"
                    aria-label={item.title}
                  />
                  <p className="flex gap-3 text-[0.688rem] tracking-[0.16em] text-zinc-500 uppercase">
                    <span className="text-rust">{item.category}</span>
                    <span>{item.date}</span>
                  </p>
                  <h3 className="text-[1.1875rem] leading-[1.35] font-normal tracking-normal text-ink">
                    {item.title}
                  </h3>
                  <p className="text-[0.875rem] leading-[1.65] text-zinc-600">{item.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-line py-13 sm:py-19" id="register">
          <div
            className={`${container} grid grid-cols-1 items-center gap-7 sm:gap-9 lg:grid-cols-2 lg:gap-13`}
          >
            <div className="flex flex-col gap-4 [&_h2_em]:text-rust">
              <p className={eyebrow}>Register your interest</p>
              <h2 className={titleSm}>
                Follow our developments as they <em>progress</em>.
              </h2>
              <p className="text-[0.969rem] leading-[1.75] text-zinc-700">
                Receive project updates, company news and Project Passport™ notifications.
              </p>
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

              <div className={field}>
                <label className={fieldLabel} htmlFor="enquirerType">
                  I am enquiring as
                </label>
                <select
                  id="enquirerType"
                  className={`${input} select-chevron cursor-pointer pr-10`}
                  name="enquirerType"
                  value={enquirerType}
                  onChange={(event) => setEnquirerType(event.target.value)}
                >
                  {ENQUIRER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
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
              ) : (
                <p className="text-center text-[0.719rem] text-zinc-600">
                  Protected against automated submissions. You will receive a confirmation email.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
