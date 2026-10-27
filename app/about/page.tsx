import type { Metadata } from 'next';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  glyph,
  section,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleLg,
  titleMd,
  titleSm,
  uppercaseLink,
} from '../../components/sections';
import {
  btnOutline,
  btnOutlineOnDark,
  btnWhite,
  container,
  eyebrow,
  eyebrowOnDark,
  media,
} from '../../components/ui';

/**
 * About — `/about`.
 *
 * The nav's second item pointed at the landing page's About band, which is two
 * paragraphs. This page is the story those paragraphs summarise: the integrated
 * model stage by stage, what documented delivery commits the company to, and
 * the values that sit behind it.
 *
 * Deliberately static. Nothing here comes from the API — there is no "company
 * profile" content type — so the page renders on a checkout with no database,
 * like the landing page it grew out of.
 */

export const metadata: Metadata = {
  title: 'About CoBuilt',
  description:
    'CoBuilt Investment Partners plans, manages and delivers residential, commercial, mixed-use and strategic developments in Nigeria — under one integrated model, with every project documented in a Project Passport™.',
};

const IMAGES = {
  villa: '/images/villa-and-pool.webp',
  site: '/images/construction-site.webp',
} as const;

/** The integrated model, in the order a development actually moves through it. */
const MODEL: Array<[string, string, string]> = [
  [
    '01',
    'Land acquisition',
    'Sites are identified, title is verified and acquisition is structured before anything is announced.',
  ],
  [
    '02',
    'Feasibility',
    'Market, technical and cost positions are appraised together, so the scheme that proceeds is the one the numbers support.',
  ],
  [
    '03',
    'Planning',
    'Design development and statutory approvals, coordinated with the consultant team.',
  ],
  [
    '04',
    'Financing',
    'The capital structure is arranged against a programme that has already been costed.',
  ],
  [
    '05',
    'Development management',
    'One accountable team from concept to completion, holding the programme, the budget and the brief together.',
  ],
  [
    '06',
    'Construction oversight',
    'Quality, cost, safety and progress are supervised on site and recorded as the work happens.',
  ],
  [
    '07',
    'Sales and client relations',
    'Buyers and occupiers deal with the same organisation that built the asset.',
  ],
  [
    '08',
    'Asset management',
    'Completed developments are operated to preserve and enhance their long-term value.',
  ],
];

const COMMITMENTS: Array<[string, string]> = [
  [
    'Every project carries an ID',
    'A development is registered with a permanent project reference the day it commences, and that reference never changes.',
  ],
  [
    'Milestones are published before they are met',
    'The scheduled date goes on the record first. The actual date is added beside it, not over it.',
  ],
  [
    'A slipped date is reported',
    'Delay is recorded as delay. Nothing is quietly revised, because a record that is edited is not a record.',
  ],
  [
    'The evidence is attached',
    'Site photography, progress reports and certificates sit with the milestone they belong to.',
  ],
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

const STATS: Array<{ value: string; plus?: boolean; label: string }> = [
  { value: '5', plus: true, label: 'Projects delivered' },
  { value: '3', label: 'Projects under development' },
  { value: '30', plus: true, label: 'Units developed' },
  { value: '5', plus: true, label: 'Locations' },
];

export default function About() {
  return (
    <SiteLayout current="/about">
      <main>
        <PageHero
          eyebrow="About CoBuilt"
          title={
            <>
              A development company built on <em>documented</em> delivery.
            </>
          }
          standfirst="CoBuilt Investment Partners plans, manages and delivers residential, commercial, mixed-use and strategic developments that create lasting value for investors, businesses and communities."
          image={IMAGES.villa}
          imageAlt="A completed CoBuilt villa and pool"
          actions={
            <>
              <a className={btnWhite} href="/passport">
                How Project Passport™ works
              </a>
              <a className={btnOutlineOnDark} href="/projects">
                See the projects
              </a>
            </>
          }
        />

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

        <section className={sectionLight}>
          <div
            className={`${container} grid grid-cols-1 items-start gap-7 sm:gap-9 md:grid-cols-2 md:gap-16`}
          >
            <div className="flex flex-col gap-5 [&_h2_em]:text-rust">
              <p className={eyebrow}>Who we are</p>
              <h2 className={titleLg}>
                One organisation, accountable for the <em>whole</em> development.
              </h2>
              <p className={bodyCopy}>
                Most developments pass through several hands. A landowner sells to a developer, the
                developer appoints a contractor, the contractor answers to a project manager, and
                the buyer deals with none of them. Every handover is a place where a commitment can
                be lost.
              </p>
              <p className={bodyCopy}>
                CoBuilt is structured to remove those seams. Our integrated model spans land
                acquisition, feasibility, planning, financing, development management, construction
                oversight, sales and asset management — which means one organisation carries the
                promise from the first site visit to the last service charge.
              </p>
              <p className="text-base leading-[1.8] text-zinc-600">
                It also means there is nowhere to hide. That is the point.
              </p>
            </div>
            <div className="flex flex-col gap-5">
              <div
                className={`${media} aspect-[4/3] w-full sm:aspect-auto sm:h-100 md:h-125`}
                style={{ backgroundImage: `url('${IMAGES.site}')` }}
                role="img"
                aria-label="A CoBuilt development under construction"
              />
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

        <section className={sectionMuted} id="integrated-model">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>The integrated model</p>
              <h2 className={titleLg}>Eight stages, one accountable team</h2>
              <p className={bodyCopy}>
                These are the stages a CoBuilt development moves through. We hold all eight rather
                than brokering between them, and each one leaves a record behind it.
              </p>
            </div>

            <ol className="grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2 md:grid-cols-4">
              {MODEL.map(([number, title, body]) => (
                <li key={number} className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
                  <span className="font-mono text-[1.75rem] leading-none font-light text-rust">
                    {number}
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{title}</h3>
                  <p className={cardBody}>{body}</p>
                </li>
              ))}
            </ol>

            <p className="mt-7 text-[0.906rem] leading-[1.7] text-zinc-700">
              The six disciplines we deliver under this model are set out on the{' '}
              <a className="text-rust underline hover:text-rust-hover" href="/services">
                services page
              </a>
              .
            </p>
          </div>
        </section>

        <section className={`${section} bg-ink`} id="passport-commitment">
          <div className={container}>
            <div className="mb-8 flex max-w-165 flex-col gap-3.5 sm:mb-11 [&_h2_em]:text-orange-on-dark">
              <p className={eyebrowOnDark}>The Passport commitment</p>
              <h2 className={`${titleMd} text-white`}>
                What “documented delivery” actually <em>commits us to</em>.
              </h2>
              <p className="text-base leading-[1.75] text-zinc-200">
                Project Passport™ is not a brochure feature. It is a set of four standing
                obligations that apply to every development we take on.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-px border border-line-on-dark bg-[rgb(255_255_255/18%)] sm:grid-cols-2">
              {COMMITMENTS.map(([title, body]) => (
                <div key={title} className="flex flex-col gap-3 bg-ink p-6 sm:p-8.5">
                  <span className={`${glyph} text-orange-on-dark`} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className="text-[0.781rem] font-semibold uppercase tracking-[0.16em] text-white">
                    {title}
                  </h3>
                  <p className="text-[0.906rem] leading-[1.7] text-zinc-200">{body}</p>
                </div>
              ))}
            </div>

            <a
              className={`${uppercaseLink} mt-7 inline-flex min-h-target items-center border-b border-orange text-[0.719rem] text-orange-on-dark hover:text-orange`}
              href="/passport"
            >
              Read how a Passport is kept →
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

        <section className={sectionMuted}>
          <div
            className={`${container} flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8`}
          >
            <div className="flex max-w-150 flex-col gap-3">
              <p className={eyebrow}>Leadership</p>
              <h2 className={titleSm}>The people accountable for it</h2>
              <p className={bodyCopy}>
                Profiles, the leadership philosophy behind documented delivery, and the video
                library.
              </p>
            </div>
            <a className={`${btnOutline} w-full sm:w-auto`} href="/leadership">
              Meet the leadership
            </a>
          </div>
        </section>

        <CtaBand
          title="Talk to us about a site, a brief or a scheme"
          body="Tell us what you have in mind and we will come back with a view on feasibility, programme and cost — in writing."
          notice
        />
      </main>
    </SiteLayout>
  );
}
