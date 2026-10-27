import PageHero from '../../../../components/PageHero';
import SiteLayout from '../../../../components/SiteLayout';
import { bodyCopy, section, sectionHead, titleMd, titleSm } from '../../../../components/sections';
import {
  btnOrange,
  btnOutline,
  btnOutlineOnDark,
  btnWhite,
  container,
  eyebrow,
  eyebrowOnLine,
  media,
} from '../../../../components/ui';
import {
  AccentedTitle,
  MILESTONE_STATUS_CLASS,
  MILESTONE_STATUS_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  cssUrl,
  dayDiff,
  formatDay,
  formatQuarter,
  formatRecordedAt,
  paragraphs,
} from '../project-shared';
import type { MilestoneStatus, MilestoneType, Status } from '../project-shared';

/**
 * Project Passport™ — `/projects/[slug]/passport`.
 *
 * The page the whole brief rests on: a permanent, public record of one
 * development, milestone by milestone (docs/design-handover.md §3.1). It is
 * meant to read as an archive — dated, factual, verifiable — and not as
 * marketing, which drives most of what follows:
 *
 *   - **It is a server component.** Every entry is in the HTML as served. No
 *     filter hides part of the record, nothing is revealed by a click, and the
 *     page needs no JavaScript to be read, printed or crawled. The project
 *     page is a client component because it drives a gallery and a tour
 *     viewer; a record has nothing to drive.
 *   - **A slipped date is reported, never revised.** Scheduled and actual dates
 *     both appear on every entry that has them, with the variance stated in
 *     days. `delayed` is an outlined chip rather than a red one: it is a fact
 *     about the programme, not a failure state, and the brand promise is that
 *     it stays visible.
 *   - **Provenance is on the page.** The project ID, the number of entries, the
 *     time each entry was written into the record and whether it was later
 *     revised — in West Africa Time, the zone the record is kept in. Credibility
 *     is the product here, so the record says where it came from.
 *   - **No investment call to action**, per the brief's §1. This page touches no
 *     figures, so it carries no investor band and no licensing notice either;
 *     its closing band points at the development and the rest of the portfolio.
 *
 * Three states besides the record: a Passport that is open with nothing
 * recorded yet, a project whose Passport is not open at all, and a database
 * that could not be reached.
 */

export interface RecordEntry {
  id: string;
  /** Position in the published sequence — the number a reader cites. */
  index: number;
  type: MilestoneType;
  typeLabel: string;
  label: string;
  description: string | null;
  scheduledDate: string | null;
  actualDate: string | null;
  status: MilestoneStatus;
  photoUrls: string[];
  /** Vetted https only, with a name read from the URL's last segment. */
  documents: Array<{ url: string; name: string; kind: string | null }>;
  /** Vetted https only. */
  videoUrl: string | null;
  /** When the entry was written into the record. */
  recordedAt: string | null;
  /** When it was last changed, if that happened after it was written. */
  revisedAt: string | null;
}

export interface PassportProject {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: Status;
  projectType: string | null;
  location: string | null;
  sector: string | null;
  featuredImageUrl: string | null;
  /** Vetted https only. */
  brochureUrl: string | null;
  /** YouTube links only, vetted on the server. */
  timelineVideoUrls: string[];
  passport: { enabled: boolean; startDate: string | null; completionTarget: string | null };
}

export interface RecordSummary {
  total: number;
  completed: number;
  delayed: number;
  percent: number;
  /** The most recent entry recorded against the record, not a milestone date. */
  lastEntry: string | null;
  /** The entry the record is standing at, for the anchor in the progress band. */
  nextIndex: number | null;
}

export interface PassportRecordProps {
  project: PassportProject | null;
  entries: RecordEntry[];
  /** Null when the project's Passport is not open. */
  summary: RecordSummary | null;
}

const uppercaseLink =
  'inline-flex min-h-target items-center text-[0.719rem] font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover';
const dataLabel = 'text-[0.688rem] font-semibold uppercase tracking-[0.16em] text-zinc-700';

/**
 * A fact the record does not hold.
 *
 * It drops the mono face and the ink: in a column of dates, "Not yet recorded"
 * set like a date reads as one. The mono face is reserved for values the
 * record actually carries.
 */
function Absent({ children }: { children: string }) {
  return <span className="font-sans text-[0.875rem] text-zinc-600">{children}</span>;
}

/**
 * What the two dates on an entry say about each other, in words.
 *
 * The variance is the whole point of publishing both: "5 days later than the
 * published date" is the claim the brand makes, and a reader should not have to
 * subtract two dates to find it. An entry reported delayed with no actual date
 * yet says so without inventing a revised one.
 */
function varianceNote(entry: RecordEntry): string | null {
  const diff = dayDiff(entry.scheduledDate, entry.actualDate);

  if (diff === null) {
    return entry.status === 'delayed'
      ? 'Reported delayed. The scheduled date above stands as it was published, and has not been revised.'
      : null;
  }

  if (diff === 0) return 'Met on the date it was scheduled for.';
  const days = Math.abs(diff);
  const unit = days === 1 ? 'day' : 'days';
  return diff > 0
    ? `${days} ${unit} later than scheduled.`
    : `${days} ${unit} ahead of schedule.`;
}

export default function PassportRecord({ project, entries, summary }: PassportRecordProps) {
  if (!project) {
    return (
      <SiteLayout current="/projects">
        <main className="bg-white py-14 md:py-20">
          <div className={`${container} flex max-w-160 flex-col items-start gap-4`}>
            <h1 className={titleMd}>This record couldn&rsquo;t be loaded just now.</h1>
            <p className={bodyCopy}>
              This is on our side, not yours. The record itself is unchanged — nothing has been
              removed. Please try again in a moment.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a className={btnOrange} href="/projects">
                All projects
              </a>
              <a className={btnOutline} href="/passport">
                What a Passport™ records
              </a>
            </div>
          </div>
        </main>
      </SiteLayout>
    );
  }

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Projects', href: '/projects' },
    { label: project.title, href: `/projects/${project.slug}` },
    { label: 'Passport™' },
  ];

  const opened = formatDay(project.passport.startDate);
  const target = formatQuarter(project.passport.completionTarget);
  const lastEntry = formatRecordedAt(summary?.lastEntry ?? null);

  // A project whose Passport has not been opened. The URL is a real one for a
  // real development, so it answers rather than 404s — and `page.tsx` keeps it
  // out of the index.
  if (!summary) {
    return (
      <SiteLayout current="/projects">
        <main>
          <PageHero
            eyebrow="Project Passport™"
            title={
              <>
                No Passport is open for this <em>development</em>.
              </>
            }
            standfirst={`A Project Passport™ is opened for ${project.title} when the development reaches the point at which its milestones begin to be recorded. Nothing has been recorded against it yet.`}
            trail={trail}
            actions={
              <>
                <a className={btnWhite} href={`/projects/${project.slug}`}>
                  View the development
                </a>
                <a className={btnOutlineOnDark} href="/passport">
                  What a Passport™ records
                </a>
              </>
            }
            meta={
            <>
              Project ID <span className="tracking-normal normal-case">{project.id}</span>
            </>
          }
            {...(project.featuredImageUrl
              ? { image: project.featuredImageUrl, imageAlt: project.title }
              : {})}
          />
          <RecordTerms project={project} />
        </main>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout
      current="/projects"
      {...(project.featuredImageUrl ? { preloadImage: project.featuredImageUrl } : {})}
    >
      <main>
        <PageHero
          eyebrow="Project Passport™"
          title={<AccentedTitle title={project.title} />}
          standfirst={`The permanent, public record of this development — every mandatory milestone, the date it was scheduled for, the date it was met, and when each entry was written into the record.`}
          trail={trail}
          actions={
            <>
              <a className={btnWhite} href="#record">
                Read the record
              </a>
              <a className={btnOutlineOnDark} href={`/projects/${project.slug}`}>
                View the development
              </a>
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
            </>
          }
          meta={
            <>
              Project ID <span className="tracking-normal normal-case">{project.id}</span>
            </>
          }
          {...(project.featuredImageUrl
            ? { image: project.featuredImageUrl, imageAlt: project.title }
            : {})}
        />

        {/*
          Provenance before progress. A reader arriving from a link should be
          able to see what this record is of, and how current it is, before
          reading a single entry.
        */}
        <section className="border-b border-line bg-white py-9 md:py-11" aria-labelledby="record-summary-title">
          <div className={`${container} flex flex-col gap-6`}>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <h2 id="record-summary-title" className={`${titleSm} flex items-center gap-3.5`}>
                The record
                <span className={STATUS_CLASS[project.status]}>{STATUS_LABEL[project.status]}</span>
              </h2>
              <a className={uppercaseLink} href="/passport">
                What a Passport™ records →
              </a>
            </div>

            {/*
              Two columns even on the narrowest phone. These are six short
              facts, and stacking them put most of a screen of metadata between
              the reader and the record.
            */}
            <dl className="reveal grid grid-cols-2 gap-px border border-zinc-300 bg-zinc-300 lg:grid-cols-3">
              <div className="bg-white p-4 sm:p-5">
                <dt className={dataLabel}>Development</dt>
                <dd className="text-[0.938rem]">
                  <a
                    className="inline-flex min-h-target items-center text-ink underline hover:text-rust"
                    href={`/projects/${project.slug}`}
                  >
                    {project.title}
                  </a>
                </dd>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <dt className={dataLabel}>Location</dt>
                <dd className="mt-2 text-[0.938rem] text-zinc-700">
                  {project.location ?? <Absent>Not published</Absent>}
                </dd>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <dt className={dataLabel}>Passport opened</dt>
                <dd className="mt-2 font-mono text-[0.938rem] text-zinc-700">
                  {opened ?? <Absent>Not published</Absent>}
                </dd>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <dt className={dataLabel}>Completion target</dt>
                <dd className="mt-2 font-mono text-[0.938rem] text-zinc-700">
                  {target ?? <Absent>Not published</Absent>}
                </dd>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <dt className={dataLabel}>Entries recorded</dt>
                <dd className="mt-2 font-mono text-[0.938rem] text-zinc-700">
                  {summary.total}
                </dd>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <dt className={dataLabel}>Last entry recorded</dt>
                <dd className="mt-2 font-mono text-[0.938rem] text-zinc-700">
                  {lastEntry ?? <Absent>No entries yet</Absent>}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {project.timelineVideoUrls.length > 0 ? (
          <section className="border-b border-line bg-white py-8 md:py-10" aria-labelledby="timeline-videos-title">
            <div className={`${container} flex flex-col gap-4`}>
              <h2 id="timeline-videos-title" className={titleSm}>
                Watch the timeline
              </h2>
              <ul className="flex flex-wrap gap-2">
                {project.timelineVideoUrls.map((url, index) => (
                  <li key={url}>
                    <a
                      className="inline-flex min-h-target items-center gap-2.5 border border-zinc-500 px-3.5 text-[0.844rem] text-zinc-700 hover:border-ink hover:text-ink"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span aria-hidden="true" className="text-rust">
                        ▶
                      </span>
                      {project.timelineVideoUrls.length === 1
                        ? 'Timeline video on YouTube'
                        : `Timeline video ${index + 1} on YouTube`}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {summary.total > 0 ? (
          <section className="border-b border-line bg-zinc-100 py-8 md:py-10" aria-label="Milestone progress">
            <div
              className={`${container} grid grid-cols-1 gap-7 md:grid-cols-[minmax(0,1fr)_280px] md:items-center md:gap-11`}
            >
              <div className="flex flex-col gap-3">
                <p className="text-[1.875rem] font-light tracking-[-0.03em]">
                  <span className="font-mono text-[1.75rem]">{summary.completed}</span> of{' '}
                  <span className="font-mono text-[1.75rem]">{summary.total}</span> milestones
                  recorded as complete
                </p>
                <div
                  className="flex gap-1"
                  role="progressbar"
                  aria-label={`${project.title} — Project Passport progress`}
                  aria-valuenow={summary.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {/* A long record is a single bar; a short one keeps its segments. */}
                  {summary.total <= 20 ? (
                    Array.from({ length: summary.total }, (_, index) => (
                      <span
                        key={index}
                        className={`h-2.5 flex-1 ${
                          index < summary.completed
                            ? 'bg-rust'
                            : index === summary.completed
                              ? 'bg-ink'
                              : 'bg-zinc-300'
                        }`}
                      />
                    ))
                  ) : (
                    <span className="h-2.5 flex-1 bg-zinc-300">
                      <span
                        className="block h-full bg-rust"
                        style={{ width: `${summary.percent}%` }}
                      />
                    </span>
                  )}
                </div>
                <p className="text-[0.781rem] text-zinc-700">
                  <span className="font-mono">{summary.percent}%</span> complete
                </p>
                {summary.nextIndex !== null ? (
                  <a
                    className="inline-flex min-h-target items-center self-start text-[0.781rem] text-rust-hover underline"
                    href={`#entry-${summary.nextIndex}`}
                  >
                    The record stands at entry{' '}
                    <span className="ml-1 font-mono">
                      {String(summary.nextIndex).padStart(2, '0')}
                    </span>
                  </a>
                ) : null}
              </div>

              {/*
                The delay disclosure. Saying it here, above the record, is the
                promise being kept: a reader does not have to find it.
              */}
              <div className="border-t border-zinc-300 pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-7">
                <p className={eyebrowOnLine}>
                  {summary.delayed > 0 ? 'Reported delays' : 'Programme'}
                </p>
                <p className="mt-2 text-[0.938rem] leading-[1.7] text-zinc-700">
                  {summary.delayed > 0
                    ? `${
                        summary.delayed === 1
                          ? 'One milestone on this record is'
                          : `${summary.delayed} milestones on this record are`
                      } reported delayed. Scheduled dates are shown as they were published, beside the dates actually met.`
                    : 'No milestone on this record is reported delayed. Where a date does slip, it is reported here rather than revised.'}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section id="record" className={section} aria-labelledby="record-title">
          <div className={`${container} flex flex-col gap-8`}>
            <div className={`${sectionHead} [&_h2_em]:text-rust`}>
              <p className={eyebrow}>Milestone by milestone</p>
              <h2 id="record-title" className={titleMd}>
                Every entry, <em>as it was recorded</em>.
              </h2>
            </div>

            {entries.length === 0 ? (
              /*
                Passport open, nothing recorded. The designed state matters: an
                empty archive has to read as "not yet" rather than as a page
                that failed to load.
              */
              <div className="flex max-w-160 flex-col items-start gap-4 border border-line bg-zinc-100 p-7 sm:p-9">
                <p className="font-mono text-[0.688rem] uppercase tracking-[0.16em] text-zinc-700">
                  00 · No entries
                </p>
                <h3 className={titleSm}>
                  This Passport™ is open. Nothing has been recorded against it yet.
                </h3>
                <p className={bodyCopy}>
                  The first entry is written when {project.title} reaches its first mandatory
                  milestone. From then on every milestone is recorded here with the date it was
                  scheduled for, the date it was met, and the photography and documents attached
                  to it. Entries are added, never rewritten.
                </p>
                <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                  <a className={btnOutline} href={`/projects/${project.slug}`}>
                    View the development
                  </a>
                  <a className={btnOutline} href="/passport">
                    What a Passport™ records
                  </a>
                </div>
              </div>
            ) : (
              <ol className="flex flex-col border-b border-line">
                {entries.map((entry) => (
                  <Entry key={entry.id} entry={entry} projectTitle={project.title} />
                ))}
              </ol>
            )}
          </div>
        </section>

        <RecordTerms project={project} />
      </main>
    </SiteLayout>
  );
}

/**
 * One entry in the record.
 *
 * The left rail carries the entry's number and its status, so the sequence and
 * the state of the programme are both readable by scanning one column. The body
 * carries the dates first — before the description, the photography or the
 * documents — because the dates are what the record is for.
 */
function Entry({ entry, projectTitle }: { entry: RecordEntry; projectTitle: string }) {
  const scheduled = formatDay(entry.scheduledDate);
  const actual = formatDay(entry.actualDate);
  const variance = varianceNote(entry);
  const recorded = formatRecordedAt(entry.recordedAt);
  const revised = formatRecordedAt(entry.revisedAt);
  const body = paragraphs(entry.description);
  const number = String(entry.index).padStart(2, '0');

  return (
    <li
      id={`entry-${entry.index}`}
      className="grid scroll-mt-24 grid-cols-1 gap-x-9 gap-y-4 border-t border-line py-8 md:grid-cols-[7.5rem_minmax(0,1fr)] md:py-10"
    >
      <div className="flex flex-row items-center gap-3.5 md:flex-col md:items-start md:gap-3">
        <span className="font-mono text-[1.5rem] leading-none text-rust">{number}</span>
        <span className={MILESTONE_STATUS_CLASS[entry.status]}>
          {MILESTONE_STATUS_LABEL[entry.status]}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[1.375rem] font-normal tracking-[-0.02em]">{entry.label}</h3>
          {/* The standard milestone this entry is, where the editor renamed it. */}
          {entry.label !== entry.typeLabel ? (
            <p className="text-[0.781rem] uppercase tracking-[0.14em] text-zinc-600">
              {entry.typeLabel}
            </p>
          ) : null}
        </div>

        <dl className="flex gap-px border border-zinc-300 bg-zinc-300">
          <div className="flex-1 bg-white px-4 py-3.5 sm:px-4.5">
            <dt className={dataLabel}>Scheduled for</dt>
            <dd className="mt-1.5 font-mono text-[0.875rem] text-zinc-700 sm:text-[0.938rem]">
              {scheduled ?? <Absent>Not published</Absent>}
            </dd>
          </div>
          <div className="flex-1 bg-white px-4 py-3.5 sm:px-4.5">
            <dt className={dataLabel}>
              {entry.status === 'completed' ? 'Met on' : 'Date met'}
            </dt>
            <dd className="mt-1.5 font-mono text-[0.875rem] text-zinc-700 sm:text-[0.938rem]">
              {actual ?? <Absent>Not yet recorded</Absent>}
            </dd>
          </div>
        </dl>

        {variance ? (
          <p className="border-l-3 border-orange pl-4 text-[0.875rem] leading-[1.7] text-zinc-700">
            {variance}
          </p>
        ) : null}

        {body.length > 0
          ? body.map((part) => (
              <p key={part.slice(0, 40)} className="text-[0.969rem] leading-[1.75] text-zinc-700">
                {part}
              </p>
            ))
          : null}

        {entry.photoUrls.length > 0 ? (
          <figure className="flex flex-col gap-2.5">
            <figcaption className={dataLabel}>
              Site photography · <span className="font-mono">{entry.photoUrls.length}</span>
            </figcaption>
            {/*
              An odd number of photographs leaves a hole in the last row of a
              two-column grid, which reads as a missing image rather than as
              the end of the set. On a phone the last one takes the full width
              instead; from `sm` the columns change and the parity with it, so
              the rule is scoped to the width it is true for.
            */}
            <div className="grid grid-cols-2 gap-2 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2 max-sm:[&>*:last-child:nth-child(odd)]:aspect-[2/1] sm:grid-cols-3 md:grid-cols-4">
              {entry.photoUrls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className={`${media} aspect-[4/3]`}
                  style={{ backgroundImage: cssUrl(url) }}
                  role="img"
                  aria-label={`${projectTitle} — ${entry.label}, photograph ${index + 1} of ${entry.photoUrls.length}`}
                />
              ))}
            </div>
          </figure>
        ) : null}

        {entry.documents.length > 0 || entry.videoUrl ? (
          <div className="flex flex-col gap-2.5">
            <p className={dataLabel}>Attached to this entry</p>
            <ul className="flex flex-wrap gap-2">
              {entry.documents.map((document) => (
                <li key={document.url}>
                  {/*
                    A document is a third-party URL and may be a PDF the browser
                    hands to its own viewer, so it opens in a new tab rather
                    than replacing the record. `noreferrer` keeps this URL out
                    of the referrer sent to the CDN.
                  */}
                  <a
                    className="inline-flex min-h-target items-center gap-2.5 border border-zinc-500 px-3.5 text-[0.844rem] text-zinc-700 hover:border-ink hover:text-ink"
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span aria-hidden="true" className="text-rust">
                      ◈
                    </span>
                    {document.name}
                    {document.kind ? (
                      <span className="font-mono text-[0.688rem] text-zinc-600">
                        {document.kind}
                      </span>
                    ) : null}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
              {entry.videoUrl ? (
                <li>
                  <a
                    className="inline-flex min-h-target items-center gap-2.5 border border-zinc-500 px-3.5 text-[0.844rem] text-zinc-700 hover:border-ink hover:text-ink"
                    href={entry.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span aria-hidden="true" className="text-rust">
                      ▶
                    </span>
                    Site video
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {/*
          The entry's own provenance. `recorded` is when this entry was written
          into the record, which is not the date the milestone happened on —
          the gap between the two is part of what a reader is checking.
        */}
        <p className="border-t border-line pt-3.5 font-mono text-[0.719rem] leading-[1.6] text-zinc-600">
          Entry {number}
          {recorded ? ` · recorded ${recorded}` : ''}
          {revised ? ` · revised ${revised}` : ''}
        </p>
      </div>
    </li>
  );
}

/**
 * How the record is kept, and where to go next.
 *
 * The closing band on a page whose credibility is the product states the terms
 * the record is kept under. There is no call to action here beyond the rest of
 * the portfolio: this page publishes no figures, so §1's licensing notice has
 * nothing to attach to.
 */
function RecordTerms({ project }: { project: PassportProject }) {
  return (
    <section className="bg-ink py-12 text-white sm:py-15 md:py-18" aria-labelledby="record-terms-title">
      <div
        className={`${container} reveal-stagger grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-13`}
      >
        <div className="flex flex-col gap-4 [&_h2_em]:text-orange-on-dark">
          <p className="text-[0.719rem] font-medium uppercase tracking-[0.28em] text-orange-on-dark">
            How this record is kept
          </p>
          <h2 id="record-terms-title" className={`${titleSm} text-white`}>
            Entries are added. They are <em>never rewritten</em>.
          </h2>
          <ul className="flex flex-col gap-2.5">
            {[
              'An entry is written at each mandatory milestone — commencement, foundation, superstructure, roofing, MEP, finishes, practical completion and handover.',
              'Every entry shows the date the milestone was scheduled for alongside the date it was met, so a slipped date is reported rather than quietly revised.',
              'The time each entry was written into the record is shown with it, in West Africa Time. Where an entry was later corrected, the record says so.',
              'Site photography, progress reports and certificates are attached to the entry they belong to, and stay attached after handover.',
            ].map((line) => (
              <li key={line.slice(0, 32)} className="flex gap-3 text-[0.938rem] leading-[1.7] text-zinc-200">
                <span className="text-orange-on-dark" aria-hidden="true">
                  ◈
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch">
          <a className={btnWhite} href={`/projects/${project.slug}`}>
            View the development
          </a>
          <a className={btnOutlineOnDark} href="/projects">
            All projects
          </a>
        </div>
      </div>
    </section>
  );
}
