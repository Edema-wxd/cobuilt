import { Fragment, useEffect, useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Landing.module.css';

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

const IMAGES = {
  hero: '/images/hero-aerial-estate.jpg',
  villa: '/images/villa-and-pool.jpg',
  site: '/images/construction-site.jpg',
  apartments: '/images/apartment-blocks.jpg',
} as const;

const PHONE = '+234 700 262 8458';
const PHONE_HREF = 'tel:+2347002628458';
const EMAIL = 'hello@cobuiltpartners.com';

/** The nine-item global navigation the standards document mandates. */
const NAV: Array<{ label: string; href: string }> = [
  { label: 'Home', href: '#top' },
  { label: 'About', href: '#about' },
  { label: 'Leadership', href: '#leadership' },
  { label: 'Services', href: '#services' },
  { label: 'Projects', href: '#projects' },
  { label: 'Passport™', href: '#passport' },
  { label: 'Media', href: '#media' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '#register' },
];

const STATS: Array<{ value: string; plus?: boolean; label: string }> = [
  { value: '5', plus: true, label: 'Projects delivered' },
  { value: '3', label: 'Projects under development' },
  { value: '30', plus: true, label: 'Units developed' },
  { value: '5', plus: true, label: 'Locations' },
];

const SERVICES: Array<{ title: string; body: string; informational?: boolean }> = [
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

const STATUS_CLASS: Record<ProjectStatus, string> = {
  ongoing: styles.statusOngoing!,
  completed: styles.statusCompleted!,
  future: styles.statusFuture!,
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
  { index: '03', name: 'Construction started', date: '05 Mar 2026', done: true },
  { index: '04', name: 'Roofing', date: 'Nov 2026', done: false },
  { index: '05', name: 'Building services installation', date: 'Feb 2027', done: false },
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

/** Rendered as plain text until the page behind it exists. */
const FOOTER_COLUMNS: Array<{ head: string; items: Array<{ label: string; href?: string }> }> = [
  {
    head: 'Company',
    items: [
      { label: 'About', href: '#about' },
      { label: 'Leadership', href: '#leadership' },
      { label: 'Governance' },
      { label: 'Careers' },
    ],
  },
  {
    head: 'Projects',
    items: [
      { label: 'Past projects', href: '#projects' },
      { label: 'Ongoing projects', href: '#projects' },
      { label: 'Future projects', href: '#projects' },
      { label: 'Project Passport™', href: '#passport' },
    ],
  },
  {
    head: 'Resources',
    items: [
      { label: 'News & insights', href: '#media' },
      { label: 'Video library', href: '#leadership' },
      { label: 'Downloads' },
      { label: 'FAQs' },
    ],
  },
  {
    head: 'Legal',
    items: [
      { label: 'Privacy Policy' },
      { label: 'Terms & Conditions' },
      { label: 'Cookie Policy' },
      { label: 'Accessibility Statement' },
    ],
  },
];

const MARQUEE_PHRASES = ['CoBuilt Investment Partners', 'Building Trust Through Every Brick'];

const COOKIE_KEY = 'cobuilt.cookie-consent';

type FormState = 'idle' | 'sending' | 'done' | 'error';

interface ApiResponse {
  message?: string;
  error?: { message?: string; details?: Array<{ field?: string; message?: string }> };
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
  const [navOpen, setNavOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enquirerType, setEnquirerType] = useState<string>(ENQUIRER_TYPES[0]);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  // Undecided until the stored choice is read, so the banner never flashes for
  // someone who has already answered it.
  const [cookieChoice, setCookieChoice] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      setCookieChoice(window.localStorage.getItem(COOKIE_KEY));
    } catch {
      // Private mode or blocked storage: show the banner, store nothing.
      setCookieChoice(null);
    }
  }, []);

  function recordCookieChoice(choice: 'all' | 'essential'): void {
    setCookieChoice(choice);
    try {
      window.localStorage.setItem(COOKIE_KEY, choice);
    } catch {
      // The choice still applies to this page view.
    }
  }

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
    <div className={styles.page}>
      <Head>
        <title>CoBuilt Investment Partners — Building Trust Through Every Brick</title>
        <meta
          name="description"
          content="CoBuilt Investment Partners delivers high-quality residential, commercial, mixed-use and strategic developments in Nigeria. Every project carries a Project Passport — a permanent, public record from commencement to handover."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1c1c1c" />
      </Head>

      <div className={styles.utility}>
        <div className={`${styles.container} ${styles.utilityInner}`}>
          <div className={styles.utilityContact}>
            <a href={PHONE_HREF}>{PHONE}</a>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </div>
          <div className={styles.utilitySocial}>
            <a href="#register">WhatsApp Business</a>
            <a href="#register">LinkedIn</a>
            <a href="#leadership">YouTube</a>
            <a className={styles.utilitySearch} href="#projects">
              Search
            </a>
          </div>
        </div>
      </div>

      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <a href="#top" aria-label="CoBuilt Investment Partners — home">
            <img
              className={styles.logo}
              src="/images/cobuilt-logo-light.png"
              alt="CoBuilt Investment Partners"
              width={112}
              height={38}
            />
          </a>

          <nav
            className={navOpen ? `${styles.nav} ${styles.navOpen}` : styles.nav}
            aria-label="Main"
          >
            {NAV.map((item, index) => (
              <a
                key={item.label}
                className={index === 0 ? styles.navLinkActive : styles.navLink}
                href={item.href}
                aria-current={index === 0 ? 'page' : undefined}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a className={styles.navCta} href="#register">
              Discuss your project
            </a>
          </nav>

          <button
            className={styles.navToggle}
            type="button"
            aria-expanded={navOpen}
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span className={styles.navToggleBars} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div
            className={styles.heroPhoto}
            style={{ backgroundImage: `url('${IMAGES.hero}')` }}
            role="img"
            aria-label="Aerial view of a CoBuilt residential estate"
          />
          <div className={styles.heroScrim} aria-hidden="true" />

          <div className={`${styles.container} ${styles.heroInner}`}>
            <div className={styles.heroRail} aria-hidden="true">
              <span className={styles.heroRailLine} />
              <span className={styles.heroRailText}>Follow us</span>
              <span className={styles.heroRailLine} />
            </div>

            <div className={styles.heroBody}>
              <p className={styles.eyebrowOnDark}>Building Trust Through Every Brick</p>
              <h1 className={styles.heroTitle}>
                Creating sustainable developments. Delivering <em>lasting value</em>.
              </h1>
              <p className={styles.heroLead}>
                CoBuilt Investment Partners delivers high-quality residential, commercial, mixed-use
                and strategic developments that create lasting value for investors, businesses and
                communities.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.btnOrange} href="#register">
                  Discuss your project
                </a>
                <a className={styles.btnWhite} href="#projects">
                  Explore our projects
                </a>
                <a className={styles.btnOutlineOnDark} href="#register">
                  Contact us
                </a>
              </div>
              <div className={styles.heroDots} aria-hidden="true">
                <span className={styles.heroDotActive} />
                <span className={styles.heroDot} />
                <span className={styles.heroDot} />
              </div>
            </div>

            <div className={styles.heroCall}>
              <span className={styles.heroCallLabel}>Call us</span>
              <a className={styles.heroCallNumber} href={PHONE_HREF}>
                {PHONE}
              </a>
              <span className={styles.heroCallHours}>Mon–Fri, 08:00–17:00 WAT</span>
            </div>
          </div>
        </section>

        <section className={styles.stats} aria-label="CoBuilt at a glance">
          <div className={`${styles.container} ${styles.statsInner}`}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <p className={styles.statValue}>
                  {stat.value}
                  {stat.plus ? <span>+</span> : null}
                </p>
                <p className={styles.statLabel}>{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.sectionLight} id="about">
          <div className={`${styles.container} ${styles.aboutGrid}`}>
            <div className={styles.aboutCopy}>
              <p className={styles.eyebrow}>About CoBuilt</p>
              <h2 className={styles.sectionTitleLg}>
                A development company built on <em>documented</em> delivery.
              </h2>
              <p className={styles.aboutLead}>
                CoBuilt Investment Partners plans, manages and delivers residential, commercial,
                mixed-use and strategic developments. Our integrated model spans land acquisition,
                feasibility, planning, financing, development management, construction oversight,
                sales and asset management.
              </p>
              <p className={styles.aboutBody}>
                That record is Project Passport™ — a permanent, public account of each development,
                from commencement through to handover.
              </p>
              <a className={styles.textLink} href="#passport">
                Read our story
              </a>
            </div>
            <div
              className={styles.aboutPhoto}
              style={{ backgroundImage: `url('${IMAGES.villa}')` }}
              role="img"
              aria-label="A completed CoBuilt villa and pool"
            />
          </div>
        </section>

        <section className={styles.sectionMuted} id="services">
          <div className={styles.container}>
            <div className={styles.servicesHead}>
              <p className={styles.eyebrow}>Our services</p>
              <h2 className={styles.sectionTitleLg}>What we do</h2>
              <p className={styles.servicesLead}>
                Six disciplines delivered under one governance framework — from feasibility through
                to practical completion and handover.
              </p>
            </div>

            <div className={styles.serviceGrid}>
              {SERVICES.map((service) => (
                <article
                  key={service.title}
                  className={service.informational ? styles.serviceCardMuted : styles.serviceCard}
                >
                  <span
                    className={styles.glyph}
                    style={service.informational ? { color: 'var(--zinc-500)' } : undefined}
                    aria-hidden="true"
                  >
                    ◈
                  </span>
                  <h3 className={styles.serviceTitle}>{service.title}</h3>
                  <p className={styles.serviceBody}>{service.body}</p>
                  {service.informational ? (
                    <p className={styles.serviceBadge}>Informational</p>
                  ) : (
                    <a className={styles.serviceMore} href="#register">
                      Learn more →
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.sectionLight} id="projects">
          <div className={styles.container}>
            <div className={styles.projectsHead}>
              <div className={styles.projectsHeadCopy}>
                <p className={styles.eyebrow}>Featured projects</p>
                <h2 className={styles.sectionTitleLg}>
                  Delivered, under construction, and planned
                </h2>
              </div>
              <div className={styles.filters} role="group" aria-label="Filter projects by stage">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={filter === option.value ? styles.filterActive : styles.filter}
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.projectGrid}>
              {visibleProjects.map((project) => (
                <article key={project.id} className={styles.projectCard}>
                  <div
                    className={styles.projectPhoto}
                    style={{ backgroundImage: `url('${project.image}')` }}
                    role="img"
                    aria-label={`${project.title}, ${project.place}`}
                  />
                  <div className={styles.projectBody}>
                    <div className={styles.projectMetaRow}>
                      <span className={styles.projectId}>{project.id}</span>
                      <span className={STATUS_CLASS[project.status]}>{project.statusLabel}</span>
                    </div>
                    <h3 className={styles.projectTitle}>{project.title}</h3>
                    <p className={styles.projectTagline}>{project.tagline}</p>

                    <div className={styles.projectSpecs}>
                      {project.specs.map((spec) => (
                        <p key={spec} className={styles.projectSpec}>
                          {spec}
                        </p>
                      ))}
                    </div>

                    {project.progress ? (
                      <div className={styles.progress}>
                        <p className={styles.progressRow}>
                          <span>{project.progress.stage}</span>
                          <b>{project.progress.percent}%</b>
                        </p>
                        <div
                          className={styles.progressTrack}
                          role="progressbar"
                          aria-label={`${project.title} ${project.progress.stage} progress`}
                          aria-valuenow={project.progress.percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={styles.progressFill}
                            style={{ width: `${project.progress.percent}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.projectFoot}>
                      <span className={styles.projectPlace}>{project.place}</span>
                      <a className={styles.projectLink} href="#passport">
                        {project.linkLabel}
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.projectsFoot}>
              <a className={styles.btnOutline} href="#register">
                Explore all projects
              </a>
            </div>
          </div>
        </section>

        <section className={styles.passport} id="passport">
          <div
            className={styles.passportPhoto}
            style={{ backgroundImage: `url('${IMAGES.site}')` }}
            role="img"
            aria-label="Anthony Gardens under construction"
          />
          <div className={styles.passportBody}>
            <p className={styles.eyebrowOnDark}>Project Passport™ · CB-2024-014</p>
            <h2 className={styles.sectionTitleMd}>
              A permanent, public record for every <em>development</em>.
            </h2>
            <p className={styles.passportLead}>
              Each project carries a unique Project ID and a passport updated at every mandatory
              milestone, with site photography, progress reports, project team and sustainability
              features attached.
            </p>

            <ol className={styles.milestones}>
              {MILESTONES.map((milestone) => (
                <li
                  key={milestone.index}
                  className={
                    milestone.done
                      ? styles.milestone
                      : `${styles.milestone} ${styles.milestonePending}`
                  }
                >
                  <span className={styles.milestoneIndex}>{milestone.index}</span>
                  <span className={styles.milestoneName}>{milestone.name}</span>
                  <span className={styles.milestoneDate}>
                    {milestone.date}
                    <span className={styles.srOnly}>
                      {milestone.done ? ' — recorded' : ' — scheduled'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <a className={styles.btnOrange} href="#register" style={{ alignSelf: 'flex-start' }}>
              View Project Passport™
            </a>
          </div>
        </section>

        <section className={styles.sectionLight} aria-labelledby="values-title">
          <div className={styles.container}>
            <div className={styles.valuesHead}>
              <p className={styles.eyebrow}>Our values</p>
              <h2 className={styles.sectionTitleMd} id="values-title">
                Where standards meet trusted professionals
              </h2>
            </div>
            <div className={styles.valueGrid}>
              {VALUES.map(([title, body]) => (
                <div key={title} className={styles.value}>
                  <span className={styles.glyph} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className={styles.valueTitle}>{title}</h3>
                  <p className={styles.valueBody}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.sectionMuted} id="leadership">
          <div className={`${styles.container} ${styles.mediaGrid}`}>
            <div className={styles.mediaCol}>
              <p className={styles.eyebrow}>Video library</p>
              <h2 className={styles.sectionTitleSm}>Watch the work</h2>
              <figure className={styles.videoFrame} style={{ margin: 0 }}>
                <div
                  className={styles.videoPhoto}
                  style={{ backgroundImage: `url('${IMAGES.site}')` }}
                />
                <span className={styles.videoPlay} aria-hidden="true">
                  <span className={styles.videoPlayDot}>▶</span>
                </span>
                <figcaption className={styles.videoCaption}>
                  <span className={styles.videoKicker}>Project documentary · 6:42</span>
                  <span className={styles.videoTitle}>Anthony Gardens: one year on site</span>
                </figcaption>
              </figure>
              <p className={styles.videoNote}>
                Embedded from the official CoBuilt YouTube channel. Captions available.
              </p>
            </div>

            <div className={styles.mediaCol}>
              <p className={styles.eyebrow}>Leadership</p>
              <article className={styles.leaderCard}>
                <div className={styles.leaderPortrait}>Managing Director — approved portrait</div>
                <div className={styles.leaderBody}>
                  <div>
                    <p className={styles.leaderName}>Managing Director</p>
                    <p className={styles.leaderRole}>CoBuilt Investment Partners</p>
                  </div>
                  <p className={styles.leaderQuote}>
                    “Transparency is not a marketing exercise. It is a delivery discipline — and it
                    is how we intend to be measured.”
                  </p>
                  <a className={styles.leaderLink} href="#about">
                    Leadership philosophy →
                  </a>
                </div>
              </article>

              <figure className={styles.quoteCard} style={{ margin: 0 }}>
                <span className={styles.glyph} aria-hidden="true">
                  ◈
                </span>
                <blockquote className={styles.quoteText} style={{ margin: 0 }}>
                  “Every query we raised was answered with a document, not an assurance.”
                </blockquote>
                <figcaption className={styles.quoteFoot}>
                  <p className={styles.quoteName}>Estate Surveyor</p>
                  <p className={styles.quoteMeta}>Ridge Terraces</p>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className={styles.sectionLight} aria-labelledby="how-title">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>How it works</p>
              <h2 className={styles.sectionTitleMd} id="how-title">
                Working with CoBuilt
              </h2>
            </div>
            <ol className={styles.stepGrid}>
              {STEPS.map(([number, title, body]) => (
                <li key={number} className={styles.step}>
                  <span className={styles.stepNumber}>{number}</span>
                  <h3 className={styles.stepTitle}>{title}</h3>
                  <p className={styles.stepBody}>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className={styles.marquee} aria-hidden="true">
          <div className={styles.marqueeTrack}>
            {/* Rendered twice: the -50% translation relies on an exact duplicate. */}
            {[0, 1].map((copy) =>
              MARQUEE_PHRASES.map((phrase) => (
                <Fragment key={`${copy}-${phrase}`}>
                  <span className={styles.marqueeWord}>{phrase}</span>
                  <span className={styles.marqueeGlyph}>◈</span>
                </Fragment>
              )),
            )}
          </div>
        </div>

        <section className={styles.sectionLight} id="media">
          <div className={styles.container}>
            <div className={styles.newsHead}>
              <div className={styles.sectionHead} style={{ maxWidth: 600 }}>
                <p className={styles.eyebrow}>Media centre</p>
                <h2 className={styles.sectionTitleMd}>
                  Keep up with company updates in one place
                </h2>
              </div>
              <a className={styles.btnOutline} href="#register">
                More news
              </a>
            </div>

            <div className={styles.newsGrid}>
              {NEWS.map((item) => (
                <article key={item.title} className={styles.newsItem}>
                  <div
                    className={styles.newsPhoto}
                    style={{ backgroundImage: `url('${item.image}')` }}
                    role="img"
                    aria-label={item.title}
                  />
                  <p className={styles.newsMeta}>
                    <span className={styles.newsCategory}>{item.category}</span>
                    <span>{item.date}</span>
                  </p>
                  <h3 className={styles.newsTitle}>{item.title}</h3>
                  <p className={styles.newsExcerpt}>{item.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.register} id="register">
          <div className={`${styles.container} ${styles.registerGrid}`}>
            <div className={styles.registerCopy}>
              <p className={styles.eyebrow}>Register your interest</p>
              <h2 className={styles.sectionTitleSm}>
                Follow our developments as they <em>progress</em>.
              </h2>
              <p className={styles.registerLead}>
                Receive project updates, company news and Project Passport™ notifications.
              </p>
              <p className={styles.registerNotice}>
                This is an information request only. CoBuilt Investment Partners does not currently
                offer or solicit investment. An Investor Portal will be introduced once all required
                regulatory approvals and licences are in place.
              </p>
            </div>

            <form
              className={styles.form}
              onSubmit={(event) => {
                void register(event);
              }}
            >
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="name">
                    Full name
                  </label>
                  <input
                    id="name"
                    className={styles.input}
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    className={styles.input}
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

              <div className={styles.field}>
                <label className={styles.label} htmlFor="enquirerType">
                  I am enquiring as
                </label>
                <select
                  id="enquirerType"
                  className={styles.select}
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
              <div className={styles.honeypot} aria-hidden="true">
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

              <div className={styles.consent}>
                <input className={styles.checkbox} id="consent" type="checkbox" required />
                <label className={styles.consentText} htmlFor="consent">
                  I consent to CoBuilt processing my details in line with the Privacy Policy (NDPA).
                </label>
              </div>

              <button className={styles.submit} type="submit" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Register your interest'}
              </button>

              {message ? (
                <p
                  className={`${styles.formMsg} ${state === 'error' ? styles.msgBad : styles.msgOk}`}
                  role="status"
                >
                  {message}
                </p>
              ) : (
                <p className={styles.formNote}>
                  Protected against automated submissions. You will receive a confirmation email.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div className={styles.footerBrand}>
            <img
              className={styles.footerLogo}
              src="/images/cobuilt-logo-dark.png"
              alt="CoBuilt Investment Partners"
              width={95}
              height={32}
            />
            <p className={styles.footerAddress}>
              27 Apex Drive, TechZone District
              <br />
              Victoria Heights, Lagos
              <br />
              Mon–Fri, 08:00–17:00 WAT
            </p>
            <p className={styles.footerWhatsapp}>Chat on WhatsApp Business</p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.head} className={styles.footerCol}>
              <p className={styles.footerHead}>{column.head}</p>
              {column.items.map((item) =>
                item.href ? (
                  <a key={item.label} className={styles.footerLink} href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <span key={item.label} className={styles.footerLink}>
                    {item.label}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      </footer>

      <div className={styles.legalBar}>
        <div className={`${styles.container} ${styles.legalInner}`}>
          <span>© 2026 CoBuilt Investment Partners. All rights reserved.</span>
          <span className={styles.legalBadge}>WCAG 2.2 AA · NDPA compliant</span>
        </div>
      </div>

      {cookieChoice === null ? (
        <aside className={styles.cookie} aria-label="Cookie preferences">
          <div className={`${styles.container} ${styles.cookieInner}`}>
            <p className={styles.cookieText}>
              <strong>Cookies.</strong> Only essential cookies are enabled by default. You may
              accept analytics, functional and marketing cookies, or manage your preferences at any
              time.
            </p>
            <div className={styles.cookieActions}>
              <button
                className={styles.cookieManage}
                type="button"
                onClick={() => recordCookieChoice('essential')}
              >
                Manage
              </button>
              <button
                className={styles.cookieEssential}
                type="button"
                onClick={() => recordCookieChoice('essential')}
              >
                Essential only
              </button>
              <button
                className={styles.cookieAccept}
                type="button"
                onClick={() => recordCookieChoice('all')}
              >
                Accept all
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
