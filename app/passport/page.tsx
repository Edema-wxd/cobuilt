import type { Metadata } from 'next';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
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
import {
  btnOrange,
  btnOutline,
  btnOutlineOnDark,
  btnWhite,
  container,
  eyebrow,
  eyebrowOnDark,
  media,
} from '../../components/ui';

/**
 * Project Passport™ — `/passport`.
 *
 * The nav's Passport™ item pointed at the landing page's passport band. This is
 * the page it means: what a Passport is, what goes into one, how a delayed
 * milestone is reported, and how to read the record.
 *
 * It is the explainer, not a record. A named development's record is its own
 * page — `/projects/[slug]/passport`, reached through `passportHref` — so this
 * page sends readers to the projects index to pick one rather than singling out
 * a development the content would then have to be kept in step with.
 */

export const metadata: Metadata = {
  title: 'Project Passport™',
  description:
    'Project Passport™ is a permanent, public record of every CoBuilt development — each mandatory milestone dated, evidenced and published from commencement through to handover.',
};

const IMAGES = {
  site: '/images/construction-site.webp',
} as const;

/** The mandatory entries, in the order a development reaches them. */
const ENTRIES: Array<[string, string, string]> = [
  ['01', 'Commencement', 'The project is registered, given its permanent ID, and the programme is published.'],
  ['02', 'Foundation', 'Substructure complete, with inspection records and dated photography.'],
  ['03', 'Superstructure', 'Frame and floors, recorded slab by slab.'],
  ['04', 'Roofing', 'The building is closed in.'],
  ['05', 'MEP', 'Mechanical, electrical and plumbing installation, with test certificates.'],
  ['06', 'Finishes', 'Internal and external finishes, with the specification as built.'],
  ['07', 'Practical completion', 'The works are certified complete, with the snagging position stated.'],
  ['08', 'Handover', 'Keys, documentation and warranties transferred. The record stays open.'],
];

const STATUSES: Array<{ label: string; className: string; meaning: string }> = [
  {
    label: 'Completed',
    className: 'bg-ink text-white',
    meaning:
      'Reached and recorded, with its actual date. The scheduled date stays visible beside it.',
  },
  {
    label: 'In progress',
    className: 'bg-orange text-ink',
    meaning: 'Underway now. The scheduled date is the published commitment.',
  },
  {
    label: 'Delayed',
    className: 'border border-rust bg-white text-rust',
    meaning:
      'Past its scheduled date and not yet complete. Both dates stay on the record, and the reason is stated.',
  },
  {
    label: 'Pending',
    className: 'bg-line text-ink',
    meaning: 'Scheduled, not yet started. Listed from the day the programme is published.',
  },
];

const ATTACHMENTS: Array<[string, string]> = [
  [
    'Dated site photography',
    'Taken on site at the milestone, not selected afterwards from a marketing library.',
  ],
  [
    'Progress and inspection reports',
    'The report that was written at the time, in the form it was written.',
  ],
  [
    'Certificates and approvals',
    'Statutory approvals, test certificates and completion certificates, downloadable where they are public.',
  ],
  [
    'Film, where it exists',
    'Where a development is filmed, the footage is tied to the milestone it documents.',
  ],
];

const READING: Array<[string, string]> = [
  [
    'Project ID',
    'Issued at commencement and never reused or changed. It is how a development is cited in every document we produce.',
  ],
  [
    'Scheduled date',
    'Published before the work starts. It is the commitment, and it is not edited once made.',
  ],
  [
    'Actual date',
    'Added beside the scheduled date when the milestone is reached — not over it.',
  ],
  [
    'Recorded at',
    'The timestamp the entry itself was filed. A record that is written weeks late says so.',
  ],
];

export default function Passport() {
  return (
    <SiteLayout current="/passport">
      <main>
        <PageHero
          eyebrow="Project Passport™"
          title={
            <>
              A permanent, public record for every <em>development</em>.
            </>
          }
          standfirst="Each CoBuilt project carries a unique Project ID and a passport updated at every mandatory milestone — with site photography, progress reports, certificates and the dates that were actually met."
          image={IMAGES.site}
          imageAlt="A CoBuilt development under construction"
          actions={
            <>
              <a className={btnWhite} href="/projects">
                Browse the projects
              </a>
              <a className={btnOutlineOnDark} href="/contact">
                Ask about a project
              </a>
            </>
          }
        />

        <section className={sectionLight}>
          <div
            className={`${container} grid grid-cols-1 items-start gap-8 md:grid-cols-[1.2fr_1fr] md:gap-14`}
          >
            <div className="flex flex-col gap-5 [&_h2_em]:text-rust">
              <p className={eyebrow}>What it is</p>
              <h2 className={titleLg}>
                The claim this company rests on, written down and <em>checkable</em>.
              </h2>
              <p className={bodyCopy}>
                Development in Nigeria has a trust problem, and it is not solved by promising
                harder. It is solved by publishing a record that can be checked by anyone — a buyer,
                a partner, a lender, a journalist — without having to ask us for it.
              </p>
              <p className={bodyCopy}>
                A Project Passport™ is that record. Every development we take on is registered with
                a permanent ID, its programme is published before work starts, and each mandatory
                milestone is filed with its dates and its evidence attached. The record opens at
                commencement and is never closed, edited or quietly tidied.
              </p>
              <p className="text-base leading-[1.8] text-zinc-600">
                It is a record, not marketing. It is dated, factual and occasionally unflattering.
              </p>
            </div>

            <div className="flex flex-col gap-px border border-zinc-300 bg-zinc-300">
              {READING.map(([title, body]) => (
                <div key={title} className="flex flex-col gap-2 bg-white p-5.5 sm:p-6.5">
                  <h3 className="font-mono text-[0.719rem] font-medium uppercase tracking-[0.16em] text-rust">
                    {title}
                  </h3>
                  <p className={cardBody}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-ink py-13 sm:py-16 md:py-22" id="mandatory-entries">
          <div className={container}>
            <div className="mb-8 flex max-w-165 flex-col gap-3.5 sm:mb-11 [&_h2_em]:text-orange-on-dark">
              <p className={eyebrowOnDark}>The mandatory entries</p>
              <h2 className={`${titleMd} text-white`}>
                Eight milestones every development <em>has to</em> publish.
              </h2>
              <p className="text-base leading-[1.75] text-zinc-200">
                A project may add its own entries — a community agreement, a sustainability
                certification, a topping-out — but these eight are not optional, and a Passport
                missing one is incomplete rather than merely quiet.
              </p>
            </div>

            <ol className="flex flex-col">
              {ENTRIES.map(([number, title, body]) => (
                <li
                  key={number}
                  className="flex flex-col gap-1.5 border-t border-line-on-dark py-4 last:border-b sm:flex-row sm:items-baseline sm:gap-6 sm:py-4.5"
                >
                  <span className="w-6 flex-none font-mono text-[0.688rem] tracking-[0.14em] text-orange-on-dark">
                    {number}
                  </span>
                  <span className="w-full flex-none text-[0.969rem] text-white sm:w-52">
                    {title}
                  </span>
                  <span className="text-[0.906rem] leading-[1.7] text-zinc-200">{body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={sectionMuted} aria-labelledby="statuses-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11 [&_h2_em]:text-rust`}>
              <p className={eyebrow}>How a date is reported</p>
              <h2 className={titleMd} id="statuses-title">
                A slipped date is <em>published</em>, not revised.
              </h2>
              <p className={bodyCopy}>
                This is the part of the promise that costs something. A programme that can only ever
                show green is not a record, so a milestone carries one of four states — and
                &ldquo;delayed&rdquo; is a factual status, not a failure notice.
              </p>
            </div>

            <dl className="grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2">
              {STATUSES.map((status) => (
                <div key={status.label} className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
                  <dt>
                    <span
                      className={`inline-block whitespace-nowrap px-2.5 py-1.25 text-[0.625rem] font-bold uppercase tracking-[0.14em] ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </dt>
                  <dd className={cardBody}>{status.meaning}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-7 flex flex-col gap-2.5 border-l-3 border-orange bg-white px-5.5 py-5">
              <p className="text-[0.719rem] font-bold uppercase tracking-[0.16em] text-ink">
                Why both dates stay
              </p>
              <p className="text-[0.906rem] leading-[1.75] text-zinc-700">
                The scheduled date is what we committed to; the actual date is what happened. Keep
                only the second and the commitment disappears. Keep both and the record shows our
                delivery against our own word — which is the only measure worth publishing.
              </p>
            </div>
          </div>
        </section>

        <section className={sectionLight} aria-labelledby="attachments-title">
          <div className={container}>
            <div
              className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}
            >
              <p className={eyebrow}>What is attached</p>
              <h2 className={titleMd} id="attachments-title">
                The evidence sits with the milestone
              </h2>
              <p className={bodyCopy}>
                Each entry carries the material that proves it. What is published is the public
                record; commercially sensitive and personal material stays internal, and the
                boundary is set deliberately rather than by accident.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2 md:grid-cols-4">
              {ATTACHMENTS.map(([title, body]) => (
                <div key={title} className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
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

        <section className={sectionMuted}>
          <div
            className={`${container} grid grid-cols-1 items-center gap-7 md:grid-cols-2 md:gap-14`}
          >
            <div className="flex flex-col gap-5">
              <p className={eyebrow}>Read one</p>
              <h2 className={titleMd}>Where to find a development&rsquo;s record</h2>
              <p className={bodyCopy}>
                Every project on the index links to its Passport: the full milestone record, with
                dates, evidence and provenance, sits at its own permanent URL. Completed
                developments keep theirs — the archive is the point, so it does not come down at
                handover.
              </p>
              <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:gap-3">
                <a
                  className={btnOrange}
                  href="/projects?status=ongoing"
                >
                  Projects under way
                </a>
                <a
                  className={btnOutline}
                  href="/projects?status=completed"
                >
                  Completed records
                </a>
              </div>
            </div>
            <div
              className={`${media} aspect-[4/3] w-full sm:aspect-auto sm:h-80`}
              style={{ backgroundImage: `url('${IMAGES.site}')` }}
              role="img"
              aria-label="Site photography filed against a Passport milestone"
            />
          </div>
        </section>

        <CtaBand
          eyebrow="Questions about a record"
          title="Ask us about any entry in any Passport"
          body="If something in a record is unclear, incomplete or wrong, tell us. A published record that cannot be questioned is just a brochure with dates in it."
          notice
        />
      </main>
    </SiteLayout>
  );
}
