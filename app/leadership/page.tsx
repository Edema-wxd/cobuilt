import type { Metadata } from 'next';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import { EMAIL } from '../../components/site';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  glyph,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleLg,
  titleMd,
} from '../../components/sections';
import { btnOutline, container, eyebrow, media } from '../../components/ui';

/**
 * Leadership — `/leadership`.
 *
 * Two things the nav and the footer both promised and neither delivered: the
 * leadership profiles, and the video library the footer's "Video library" entry
 * pointed at (it went to the landing page's leadership band).
 *
 * Portraits and named profiles are still with the client for approval
 * (docs/design-handover.md §5.2), so this page does what the landing page does
 * and says so in the slot where the portrait goes, rather than filling it with
 * a stock face or an invented biography. The treatment is built; the content
 * drops in.
 */

export const metadata: Metadata = {
  title: 'Leadership',
  description:
    'The leadership of CoBuilt Investment Partners, the philosophy behind documented delivery, and the video library of work on site.',
};

const IMAGES = {
  site: '/images/construction-site.webp',
  apartments: '/images/apartment-blocks.webp',
} as const;

interface Leader {
  role: string;
  org: string;
  /** Published once the client approves the named profile and the portrait. */
  name?: string;
  quote?: string;
  remit: string[];
}

/**
 * One approved profile today. The grid takes as many as the client approves;
 * the pending card below carries the rest honestly in the meantime.
 */
const LEADERS: Leader[] = [
  {
    role: 'Managing Director',
    org: 'CoBuilt Investment Partners',
    quote:
      'Transparency is not a marketing exercise. It is a delivery discipline — and it is how we intend to be measured.',
    remit: [
      'Development strategy and capital structure',
      'Project Passport™ as a company standard',
      'Client, partner and regulatory relationships',
    ],
  },
];

const PENDING_ROLES = [
  'Development Director',
  'Construction Director',
  'Commercial Director',
  'Asset Management Lead',
];

const PHILOSOPHY: Array<[string, string]> = [
  [
    'Publish the programme, then meet it',
    'A date that only exists internally costs nothing to move. A published one does not, which is why ours go on the record before the work starts.',
  ],
  [
    'Answer with a document',
    'Where a question can be settled with a certificate, a report or a dated photograph, that is the answer our teams are expected to give.',
  ],
  [
    'Report the delay',
    'Programmes slip. A company that reports it keeps the trust; one that revises the record quietly spends it. We report it.',
  ],
  [
    'Stay inside the licence',
    'We do not offer or solicit investment, and no one here is incentivised to blur that line while the approvals are outstanding.',
  ],
];

export default function Leadership() {
  return (
    <SiteLayout current="/leadership">
      <main>
        <PageHero
          eyebrow="Leadership"
          title={
            <>
              The people <em>accountable</em> for the record.
            </>
          }
          standfirst="CoBuilt's leadership carries the Passport commitment personally: published programmes, documented milestones, and reported delays. These are the people who answer for it."
        />

        <section className={sectionLight}>
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>Profiles</p>
              <h2 className={titleLg}>Who leads the business</h2>
            </div>

            <div className="reveal-stagger grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {LEADERS.map((leader) => (
                <article key={leader.role} className="flex flex-col border border-line bg-white">
                  {/*
                    The portrait slot, not a placeholder image: an approved
                    photograph is the only thing that goes here, and saying so
                    is more honest than a stock face.
                  */}
                  <div className="flex h-45 items-start bg-line p-3.5 text-[0.719rem] text-zinc-600 sm:h-57.5">
                    {leader.role} — approved portrait
                  </div>
                  <div className="flex flex-1 flex-col gap-3.25 p-5.5 sm:p-6.5">
                    <div>
                      <p className="text-[1.25rem] font-normal text-ink">
                        {leader.name ?? leader.role}
                      </p>
                      <p className="mt-1.25 text-[0.719rem] tracking-[0.14em] text-zinc-500 uppercase">
                        {leader.name ? leader.role : leader.org}
                      </p>
                    </div>
                    {leader.quote ? (
                      <p className="text-[0.938rem] leading-[1.7] text-zinc-700 italic">
                        “{leader.quote}”
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3.5">
                      <p className="text-[0.656rem] font-semibold tracking-[0.18em] text-zinc-600 uppercase">
                        Remit
                      </p>
                      {leader.remit.map((item) => (
                        <p key={item} className="text-[0.844rem] leading-[1.6] text-zinc-700">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </article>
              ))}

              {/* The same card shape, so the grid reads as one set rather than as a gap. */}
              <article className="flex flex-col border border-line bg-zinc-50 sm:col-span-2 md:col-span-1">
                <div className="flex flex-1 flex-col gap-3.25 p-5.5 sm:p-6.5">
                  <span className={`${glyph} text-zinc-500`} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>Further profiles pending</h3>
                  <p className={cardBody}>
                    These roles are appointed and their profiles are with the company for approval.
                    Each is published here with a portrait, a remit and a professional background
                    once that approval is in place — not before.
                  </p>
                  <ul className="mt-1 flex flex-col gap-2 border-t border-line pt-3.5">
                    {PENDING_ROLES.map((role) => (
                      <li key={role} className="text-[0.844rem] leading-[1.6] text-zinc-700">
                        {role}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto pt-3.5 text-[0.781rem] leading-[1.6] text-zinc-600">
                    Media enquiries about leadership:{' '}
                    <a className="text-rust underline hover:text-rust-hover" href="/contact">
                      contact the press desk
                    </a>
                    .
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={sectionMuted} id="philosophy" aria-labelledby="philosophy-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11 [&_h2_em]:text-rust`}>
              <p className={eyebrow}>Leadership philosophy</p>
              <h2 className={titleMd} id="philosophy-title">
                Four rules we manage <em>against</em>.
              </h2>
              <p className={bodyCopy}>
                These are not aspirations on a wall. They are the standards a CoBuilt project
                manager is held to, and the reason the Passport can be public at all.
              </p>
            </div>

            <div className="reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2">
              {PHILOSOPHY.map(([title, body]) => (
                <div key={title} className="flex flex-col gap-3 bg-white p-6 sm:p-8.5">
                  <span className={`${glyph} text-orange`} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{title}</h3>
                  <p className={cardBody}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionLight} id="video-library">
          <div className={container}>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9 sm:gap-8">
              <div className={`${sectionHead} max-w-150`}>
                <p className={eyebrow}>Video library</p>
                <h2 className={titleMd}>Watch the work</h2>
              </div>
              <a className={btnOutline} href="/projects">
                Browse the projects
              </a>
            </div>

            <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1.4fr_1fr] lg:gap-9">
              {/* A still preview, not a player: the embed is wired up when the video ID
                  exists, so nothing here advertises a control that does not work yet. */}
              <figure className="relative block aspect-[16/10] w-full overflow-hidden bg-ink sm:aspect-auto sm:h-95">
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

              <div className="flex flex-col gap-5">
                <div
                  className={`${media} aspect-[16/10] w-full sm:aspect-auto sm:h-45`}
                  style={{ backgroundImage: `url('${IMAGES.apartments}')` }}
                  role="img"
                  aria-label="Completed CoBuilt apartment blocks"
                />
                <div className="flex flex-col gap-3 border border-line bg-white p-5.5 sm:p-6.5">
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>How the library works</h3>
                  <p className={cardBody}>
                    Films are embedded from the official CoBuilt YouTube channel, with captions, and
                    each one is tied to the development it documents. A project&rsquo;s own films sit
                    on its project page alongside the milestone record.
                  </p>
                  <p className={cardBody}>
                    Footage requests for press use:{' '}
                    <a className="text-rust underline hover:text-rust-hover" href={`mailto:${EMAIL}`}>
                      {EMAIL}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <CtaBand
          eyebrow="Speak to the team"
          title="Bring us a question the record should answer"
          body="Clients, partners, suppliers and journalists all reach the same desk. Tell us which you are and we will route it to the person who can answer."
        />
      </main>
    </SiteLayout>
  );
}
