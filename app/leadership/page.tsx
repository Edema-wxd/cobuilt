import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import { EMAIL } from '../../components/site';
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
  uppercaseLink,
} from '../../components/sections';
import { btnOutline, container, eyebrow, media } from '../../components/ui';
import { TIER_LABEL, TIER_ORDER, bioParagraphs } from './leadership-shared';
import { loadPublishedLeaders, type PublicLeader } from './load-leadership';
import Portrait from './portrait';
import { loadLatest } from '../videos/load-videos';
import VideoCard from '../videos/video-card';

/**
 * Leadership — `/leadership`.
 *
 * Two things the nav and the footer both promised and neither delivered: the
 * leadership profiles, and the video library the footer's "Video library" entry
 * pointed at (it went to the landing page's leadership band).
 *
 * The profiles are the published rows of `leadership`, managed at
 * /admin/leadership (or synced from the CMS): portrait, name, role,
 * qualifications, areas of expertise and the biography, then the
 * organisational structure they make up. Until a profile is published — or
 * when there is no database, as at build time — the page keeps the approval
 * state it launched with, and says so in the slot where the portrait goes
 * rather than filling it with a stock face or an invented biography
 * (docs/design-handover.md §5.2).
 */

// Regenerated at most once a minute, so a profile published in the console
// reaches the page in the same minute it reaches /api/leadership.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Leadership',
  description:
    'The leadership of CoBuilt Investment Partners, the philosophy behind documented delivery, and the video library of work on site.',
  alternates: canonical('/leadership'),
};

const IMAGES = {
  site: '/images/construction-site.webp',
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
 * The launch state, shown until a profile is published: one approved remit,
 * and the pending card carrying the rest honestly in the meantime.
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

export default async function Leadership() {
  const [leaders, interviews] = await Promise.all([
    loadPublishedLeaders(),
    loadLatest('leadership_interview', 3),
  ]);

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

        {leaders.length > 0 ? (
          <>
            <Profiles leaders={leaders} />
            <Structure leaders={leaders} />
          </>
        ) : (
          <PendingProfiles />
        )}

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

        {/*
          The footer's "Video library" entry lands here. The latest leadership
          interviews from the library (/videos), or a card into it while there
          are none. Cards link to each film's page, where the player loads on
          request; nothing here is requested from YouTube.
        */}
        <section className={sectionLight} id="video-library" aria-labelledby="video-library-title">
          <div className={container}>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-9 sm:gap-8">
              <div className={`${sectionHead} max-w-150`}>
                <p className={eyebrow}>Video library</p>
                <h2 className={titleMd} id="video-library-title">
                  {interviews.length > 0 ? 'In their own words' : 'Watch the work'}
                </h2>
                {interviews.length > 0 ? (
                  <p className={cardBody}>
                    The latest interviews with CoBuilt&rsquo;s leadership, from the video library.
                  </p>
                ) : null}
              </div>
              <a className={btnOutline} href="/videos">
                Open the video library
              </a>
            </div>

            {interviews.length > 0 ? (
              <div className="reveal-stagger grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {interviews.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <a
                className="group reveal grid grid-cols-1 border border-line bg-white lg:grid-cols-[1.4fr_1fr]"
                href="/videos"
              >
                <span className="relative block aspect-video w-full overflow-hidden bg-ink lg:aspect-auto lg:min-h-80">
                  <span
                    className={`${media} absolute inset-0 transition-transform duration-700 ease-settle group-hover:scale-104`}
                    style={{ backgroundImage: `url('${IMAGES.site}')` }}
                    aria-hidden="true"
                  />
                  <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <span className="flex size-16 items-center justify-center rounded-full border-[1.5px] border-white bg-[rgb(20_20_20/86%)] text-[1.125rem] text-white transition-colors duration-150 group-hover:bg-orange group-hover:text-ink">
                      ▶
                    </span>
                  </span>
                </span>
                <span className="flex flex-col gap-3 p-5.5 sm:p-7.5">
                  <span className={`${cardTitle} tracking-[0.16em]`}>The video library</span>
                  <span className={cardBody}>
                    Project documentaries, construction updates, drone footage and interviews from
                    the official CoBuilt YouTube channel, each tied to the development it documents.
                  </span>
                  <span className="mt-auto pt-2 text-[0.719rem] font-semibold tracking-[0.14em] text-rust uppercase group-hover:text-rust-hover">
                    Browse the films →
                  </span>
                </span>
              </a>
            )}

            <p className="mt-6 max-w-165 text-[0.844rem] leading-[1.7] text-zinc-700">
              Films play from YouTube only when you press play, with captions available in the
              player. A project&rsquo;s own films sit on its project page alongside the milestone
              record. Footage requests for press use:{' '}
              <a className="text-rust underline hover:text-rust-hover" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
              .
            </p>
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

/** The launch state: the approved remit and the roles still awaiting approval. */
function PendingProfiles() {
  return (
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
              <div className="flex h-56 items-start bg-line p-3.5 text-[0.719rem] text-zinc-600 sm:h-72">
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
  );
}

const listLabel = 'text-[0.656rem] font-semibold tracking-[0.18em] text-zinc-600 uppercase';
const listItem = 'text-[0.844rem] leading-[1.6] text-zinc-700';

/** The published profiles, in the card shape the launch state established. */
function Profiles({ leaders }: { leaders: PublicLeader[] }) {
  return (
    <section className={sectionLight} id="profiles">
      <div className={container}>
        <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
          <p className={eyebrow}>Profiles</p>
          <h2 className={titleLg}>Who leads the business</h2>
        </div>

        <div className="reveal-stagger grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {leaders.map((leader) => (
            <ProfileCard key={leader.id} leader={leader} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileCard({ leader }: { leader: PublicLeader }) {
  const href = `/leadership/${leader.slug}`;
  const bio = bioParagraphs(leader.bio);

  return (
    <article id={leader.slug} className="flex scroll-mt-24 flex-col border border-line bg-white">
      <Portrait leader={leader} className="h-72 sm:h-80" />
      <div className="flex flex-1 flex-col gap-3.25 p-5.5 sm:p-6.5">
        <div>
          <h3 className="text-[1.25rem] font-normal tracking-normal text-ink">
            <a className="hover:text-rust" href={href}>
              {leader.fullName}
            </a>
          </h3>
          {leader.roleTitle ? (
            <p className="mt-1.25 text-[0.719rem] tracking-[0.14em] text-zinc-500 uppercase">
              {leader.roleTitle}
            </p>
          ) : null}
        </div>
        {leader.summary ? <p className={cardBody}>{leader.summary}</p> : null}
        {leader.quote ? (
          <p className="text-[0.938rem] leading-[1.7] text-zinc-700 italic">“{leader.quote}”</p>
        ) : null}

        <ProfileList label="Areas of expertise" items={leader.expertise} />
        <ProfileList label="Qualifications" items={leader.qualifications} />

        {/* A native disclosure: the biography is in the HTML and opens without script. */}
        {bio.length > 0 ? (
          <details className="group border-t border-line">
            <summary
              className={`${listLabel} flex min-h-target cursor-pointer list-none items-center justify-between gap-4 hover:text-rust [&::-webkit-details-marker]:hidden`}
            >
              Professional biography
              <span
                className="flex-none text-[1.125rem] leading-none tracking-normal transition-transform group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <div className="flex flex-col gap-3 pb-1">
              {bio.map((paragraph, index) => (
                <p key={index} className="text-[0.875rem] leading-[1.7] text-zinc-700">
                  {paragraph}
                </p>
              ))}
            </div>
          </details>
        ) : null}

        <a
          className={`${uppercaseLink} mt-auto inline-flex min-h-target items-end text-[0.688rem]`}
          href={href}
        >
          Full profile<span className="sr-only">: {leader.fullName}</span>
        </a>
      </div>
    </article>
  );
}

function ProfileList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3.5">
      <p className={listLabel}>{label}</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className={listItem}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The organisational structure: the tiers that have published leaders, top
 * down, each naming its people. Drawn from the same rows as the cards, so the
 * two cannot disagree.
 */
function Structure({ leaders }: { leaders: PublicLeader[] }) {
  const tiers = TIER_ORDER.map((tier) => ({
    tier,
    members: leaders.filter((leader) => leader.tier === tier),
  })).filter(({ members }) => members.length > 0);

  return (
    <section
      className={`${section} border-t border-line bg-white`}
      id="structure"
      aria-labelledby="structure-title"
    >
      <div className={container}>
        <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11 [&_h2_em]:text-rust`}>
          <p className={eyebrow}>Organisational structure</p>
          <h2 className={titleMd} id="structure-title">
            Where each leader <em>sits</em>.
          </h2>
          <p className={bodyCopy}>
            From governance down to delivery. Each name opens the full profile.
          </p>
        </div>

        <ol className="reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300">
          {tiers.map(({ tier, members }, index) => (
            <li
              key={tier}
              className="grid grid-cols-1 gap-4 bg-white p-6 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-8 sm:p-8.5"
            >
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[0.781rem] text-rust" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className={`${cardTitle} tracking-[0.16em]`}>{TIER_LABEL[tier]}</h3>
              </div>
              <ul className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                {members.map((member) => (
                  <li key={member.id} className="flex flex-col">
                    <a
                      className="inline-flex min-h-8 items-center text-[1rem] text-ink hover:text-rust"
                      href={`/leadership/${member.slug}`}
                    >
                      {member.fullName}
                    </a>
                    {member.roleTitle ? (
                      <span className="text-[0.813rem] leading-[1.5] text-zinc-600">
                        {member.roleTitle}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
