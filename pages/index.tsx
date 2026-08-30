import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Landing.module.css';

/**
 * Public landing page.
 *
 * Deliberately static: the page renders without PostgreSQL, so `npm run dev`
 * works on a fresh checkout. The only live call is the newsletter form, which
 * posts to `/api/forms/newsletter` (CSRF-exempt, rate limited, double opt-in).
 * Project and milestone content here is illustrative and matches the seed
 * data; it is replaced by CMS-backed content when the site pages are built.
 */

interface Milestone {
  name: string;
  status: 'completed' | 'in_progress' | 'pending';
  date: string;
}

const PASSPORT_MILESTONES: Milestone[] = [
  { name: 'Commencement', status: 'completed', date: '10 Feb 2025' },
  { name: 'Foundation', status: 'completed', date: '22 May 2025' },
  { name: 'Superstructure', status: 'in_progress', date: 'Since 04 Jun 2025' },
  { name: 'Roofing', status: 'pending', date: 'Not started' },
];

const STATUS_LABEL: Record<Milestone['status'], string> = {
  completed: 'Stamped',
  in_progress: 'Open',
  pending: 'Pending',
};

const STATUS_CLASS: Record<Milestone['status'], string> = {
  completed: styles.chipDone!,
  in_progress: styles.chipActive!,
  pending: styles.chipPending!,
};

/** The eight stages of `milestone_type` — the sequence every passport follows. */
const STAGES: Array<[string, string]> = [
  ['Commencement', 'Site handover, permits'],
  ['Foundation', 'Survey, pour records'],
  ['Superstructure', 'Frame photography'],
  ['Roofing', 'Envelope sign-off'],
  ['Services', 'Mechanical and electrical tests'],
  ['Finishes', 'Inspection notes'],
  ['Practical completion', "Engineer's certificate"],
  ['Handover', 'Keys, warranties, as-builts'],
];

const PROJECTS = [
  {
    title: 'Ocean Ridge Residences',
    status: 'Under construction',
    description: 'A 48-unit waterfront residential development on the Lekki peninsula.',
    meta: 'Lekki, Lagos · Residential',
  },
  {
    title: 'Kingsway Commercial Centre',
    status: 'Completed',
    description: 'Grade-A office and retail space delivered in central Ikoyi.',
    meta: 'Ikoyi, Lagos · Commercial',
  },
  {
    title: 'Northgate Mixed-Use Quarter',
    status: 'In planning',
    description: 'A planned quarter combining residential, retail and workspace.',
    meta: 'Maitama, Abuja · Mixed use',
  },
];

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
  if (status >= 500) return 'Subscriptions are unavailable right now. Try again shortly.';
  return (
    payload?.error?.details?.[0]?.message ??
    payload?.error?.message ??
    'That address was not accepted. Check it and try again.'
  );
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  async function subscribe(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState('sending');
    setMessage('');

    try {
      const response = await fetch('/api/forms/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website, source: 'landing-page' }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok) {
        setState('error');
        setMessage(describeFailure(response.status, payload));
        return;
      }

      setState('done');
      setMessage(payload?.message ?? 'Check your inbox to confirm your subscription.');
      setEmail('');
    } catch {
      setState('error');
      setMessage('No connection to the server. Check your network and try again.');
    }
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>CoBuilt Investment Partners — every stage of the build, on record</title>
        <meta
          name="description"
          content="CoBuilt develops residential, commercial and mixed-use property in Lagos, Abuja and Port Harcourt. Every project carries a Project Passport: a public, dated record of its construction."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#06170f" />
      </Head>

      <header className={styles.nav}>
        <div className={`${styles.container} ${styles.navInner}`}>
          <a className={styles.wordmark} href="#top">
            <span className={styles.wordmarkName}>COBUILT</span>
            <span className={styles.wordmarkSub}>Investment Partners</span>
          </a>
          <nav className={styles.navLinks}>
            <a className={styles.navLink} href="#passport">
              Passport
            </a>
            <a className={styles.navLink} href="#projects">
              Projects
            </a>
            <a className={styles.navLink} href="#investors">
              Investors
            </a>
          </nav>
          <a className={styles.btnPrimary} href="#updates">
            Get updates
          </a>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero}>
          <div className={`${styles.container} ${styles.heroInner}`}>
            <div>
              <p className={styles.eyebrow}>Lagos · Abuja · Port Harcourt</p>
              <h1 className={styles.heroTitle}>
                Every stage of the build, <em>dated and evidenced</em>.
              </h1>
              <p className={styles.heroLead}>
                CoBuilt develops residential, commercial and mixed-use property across Nigeria.
                Each project carries a Project Passport — a published record of its construction,
                stage by stage, with the evidence attached to every entry.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.btnPrimary} href="#passport">
                  See what a passport records
                </a>
                <a className={styles.btnGhost} href="#projects">
                  Browse projects
                </a>
              </div>
              <div className={styles.heroFacts}>
                <div className={styles.fact}>
                  <span className={styles.factValue}>8</span>
                  <span className={styles.factLabel}>Stages per passport</span>
                </div>
                <div className={styles.fact}>
                  <span className={styles.factValue}>3</span>
                  <span className={styles.factLabel}>Cities</span>
                </div>
                <div className={styles.fact}>
                  <span className={styles.factValue}>4</span>
                  <span className={styles.factLabel}>Sectors</span>
                </div>
              </div>
            </div>

            {/* The passport itself, as it appears on a project page. */}
            <article className={styles.passport} aria-label="Example Project Passport">
              <div className={styles.passportHead}>
                <span>Project Passport™</span>
                <span>NGA · CB-001</span>
              </div>
              <div className={styles.passportBody}>
                <h2 className={styles.passportProject}>Ocean Ridge Residences</h2>
                <p className={styles.passportPlace}>Lekki, Lagos · Residential · 48 units</p>

                <ol className={styles.milestones}>
                  {PASSPORT_MILESTONES.map((milestone, index) => (
                    <li
                      key={milestone.name}
                      className={styles.milestone}
                      style={{ animationDelay: `${350 + index * 110}ms` }}
                    >
                      <span className={styles.msIndex}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.msName}>
                        {milestone.name}
                        <span className={`${styles.chip} ${STATUS_CLASS[milestone.status]}`}>
                          {STATUS_LABEL[milestone.status]}
                        </span>
                      </span>
                      <span className={styles.msDate}>{milestone.date}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className={styles.seal} aria-hidden="true">
                <span className={styles.sealTop}>Evidence</span>
                <span className={styles.sealYear}>2025</span>
                <span className={styles.sealBottom}>On file</span>
              </div>
              <p className={styles.mrz} aria-hidden="true">
                P&lt;NGACOBUILT&lt;&lt;OCEAN&lt;RIDGE&lt;RESIDENCES&lt;&lt;&lt;&lt;&lt;&lt;
                <br />
                CB0012025NGA&lt;&lt;&lt;LEKKI&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;8
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section} id="passport">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>The record</p>
              <h2 className={styles.sectionTitle}>Eight stages. Each one dated when it happens.</h2>
              <p className={styles.sectionLead}>
                A passport follows the same sequence on every project, so two developments can be
                read side by side. A stage is only marked complete when its evidence is filed
                against it — photographs, certificates, sign-offs — and the date it carries is the
                date the work was done, not the date it was written up.
              </p>
            </div>
            <ol className={styles.register}>
              {STAGES.map(([name, evidence], index) => (
                <li key={name} className={styles.stage}>
                  <span className={styles.stageIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.stageName}>{name}</span>
                  <span className={styles.stageEvidence}>{evidence}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.section} id="projects">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>Portfolio</p>
              <h2 className={styles.sectionTitle}>What we are building</h2>
              <p className={styles.sectionLead}>
                Residential, commercial and mixed-use developments, delivered under project
                management and held under asset management after handover.
              </p>
            </div>
            <div className={styles.projects}>
              {PROJECTS.map((project) => (
                <article key={project.title} className={styles.projectCard}>
                  <p className={styles.projectStatus}>{project.status}</p>
                  <h3 className={styles.projectTitle}>{project.title}</h3>
                  <p className={styles.projectDesc}>{project.description}</p>
                  <p className={styles.projectMeta}>{project.meta}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} id="investors">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>For investors</p>
              <h2 className={styles.sectionTitle}>The same record, before you commit</h2>
            </div>
            <div className={styles.investorGrid}>
              <div className={styles.investorPoints}>
                <div className={styles.point}>
                  <p className={styles.pointTitle}>Figures are published after review</p>
                  <p className={styles.pointBody}>
                    Investment amounts and return expectations appear on a project only once they
                    have been approved for publication. Editing that content withdraws it again
                    until it is re-approved.
                  </p>
                </div>
                <div className={styles.point}>
                  <p className={styles.pointTitle}>The passport is the diligence trail</p>
                  <p className={styles.pointBody}>
                    Progress is not a status update from us. It is a dated entry with the evidence
                    attached, published as the work happens and kept for the life of the project.
                  </p>
                </div>
                <div className={styles.point}>
                  <p className={styles.pointTitle}>Your data, on your terms</p>
                  <p className={styles.pointBody}>
                    Enquiries are held under the Nigeria Data Protection Act — 90 days, or two
                    years for investor enquiries — and you can request an export or erasure at any
                    point.
                  </p>
                </div>
              </div>
              <aside className={styles.notice}>
                <p className={styles.noticeLabel}>Informational only</p>
                <p className={styles.noticeBody}>
                  Nothing on this website is an offer to sell, or a solicitation of an offer to
                  buy, any security. The investor pages describe projects and process. Commitments
                  are made offline, under contract, with advisers of your choosing.
                </p>
              </aside>
            </div>
          </div>
        </section>

        <section className={styles.section} id="updates">
          <div className={styles.container}>
            <div className={styles.subscribeGrid}>
              <div>
                <p className={styles.kicker}>Milestone updates</p>
                <h2 className={styles.sectionTitle}>An email when a stage is stamped</h2>
                <p className={styles.sectionLead}>
                  One message per milestone, on the projects you follow. Confirm once, unsubscribe
                  from any email, and we hold nothing but your address.
                </p>
              </div>

              <form
                className={styles.formCard}
                onSubmit={(event) => {
                  void subscribe(event);
                }}
              >
                <div className={styles.formRow}>
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

                <button className={styles.submit} type="submit" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Sending…' : 'Subscribe'}
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
                    We send a confirmation link first. Nothing arrives until you click it.
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div>
              <p className={styles.wordmarkName}>COBUILT</p>
              <p className={styles.footerBlurb}>
                Development, project management and asset management across real estate,
                hospitality, retail and industrial property in Nigeria.
              </p>
            </div>
            <div>
              <p className={styles.footerHead}>Site</p>
              <ul className={styles.footerList}>
                <li>
                  <a href="#passport">Project Passport</a>
                </li>
                <li>
                  <a href="#projects">Projects</a>
                </li>
                <li>
                  <a href="#investors">Investors</a>
                </li>
                <li>
                  <a href="#updates">Milestone updates</a>
                </li>
              </ul>
            </div>
            <div>
              <p className={styles.footerHead}>Offices</p>
              <ul className={styles.footerList}>
                <li>Lekki, Lagos</li>
                <li>Ikoyi, Lagos</li>
                <li>Maitama, Abuja</li>
                <li>Port Harcourt</li>
              </ul>
            </div>
            <div>
              <p className={styles.footerHead}>Service</p>
              <ul className={styles.footerList}>
                <li>
                  <a href="/api/health">API status</a>
                </li>
                <li>Data held under the NDPA</li>
                <li>Export or erasure on request</li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© 2026 CoBuilt Investment Partners</span>
            <span>Project Passport™</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
