import type { ReactElement } from 'react';

/**
 * Primitives shared by `/projects/[slug]` and `/projects/[slug]/passport`.
 *
 * Both pages describe the same development, so they format the same dates,
 * label the same milestone types and badge the same statuses. The date helpers
 * in particular are correctness-critical (docs/decisions.md §2.11): a Passport
 * whose dates are off by a day is not a record. One copy, used by both.
 *
 * Nothing here imports a server-only module, so the file is safe to pull into
 * the detail page's client bundle as well as into the server-rendered record.
 */

export type Status = 'future' | 'ongoing' | 'completed';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';
export type MilestoneType =
  | 'commencement'
  | 'foundation'
  | 'superstructure'
  | 'roofing'
  | 'mep'
  | 'finishes'
  | 'practical_completion'
  | 'handover'
  | 'custom';

export const STATUS_LABEL: Record<Status, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  future: 'Upcoming',
};

export const badge =
  'whitespace-nowrap px-2.5 py-1.25 text-[0.625rem] font-bold uppercase tracking-[0.14em]';

export const STATUS_CLASS: Record<Status, string> = {
  ongoing: `${badge} bg-orange text-ink`,
  completed: `${badge} bg-ink text-white`,
  future: `${badge} bg-line text-ink`,
};

/**
 * A delayed milestone is reported, not hidden — the brand promise rests on it —
 * so it reads as a plain outlined chip rather than an error colour.
 */
export const MILESTONE_STATUS_CLASS: Record<MilestoneStatus, string> = {
  completed: `${badge} bg-ink text-white`,
  in_progress: `${badge} bg-orange text-ink`,
  delayed: `${badge} border border-ink bg-white text-ink`,
  pending: `${badge} bg-line text-ink`,
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  delayed: 'Delayed',
  pending: 'Scheduled',
};

/** The eight mandatory milestone types, plus the editor-named ninth. */
export const MILESTONE_LABEL: Record<string, string> = {
  commencement: 'Commencement',
  foundation: 'Foundation',
  superstructure: 'Superstructure',
  roofing: 'Roofing',
  mep: 'MEP',
  finishes: 'Finishes',
  practical_completion: 'Practical completion',
  handover: 'Handover',
  custom: 'Milestone',
};

/**
 * An editor-supplied URL, returned only when it is one these pages will put in
 * front of a reader: https, and nothing else. A `javascript:` or `data:` URL in
 * an `href` or an iframe `src` executes in this page's context, which is the
 * same hole `embed_code` is withheld to avoid (docs/decisions.md §2.10).
 */
export function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A YouTube link, or null. Only watch, short and youtu.be links on YouTube's own
 * hosts pass: the URL ends up in an `href`, and the record is not the place to
 * link an editor's typo, or something that merely contains "youtube".
 */
export function youtubeUrl(value: string | null): string | null {
  const url = httpsUrl(value);
  if (!url) return null;
  const { hostname } = new URL(url);
  const host = hostname.replace(/^(www|m)\./, '');
  return host === 'youtube.com' || host === 'youtu.be' ? url : null;
}

/**
 * Image URLs are editor- and CMS-supplied and land inside a CSS `url('…')`.
 * An apostrophe would close the string early — at best breaking the tile, at
 * worst letting the rest of the URL be read as further declarations.
 */
export function cssUrl(url: string): string {
  return `url('${url.replace(/[\\'"()\n\r]/g, (char) => `\\${char}`)}')`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The calendar parts of a `YYYY-MM-DD` value, or null if it is not one. */
function dateParts(value: string | null | undefined): [number, number, number] | null {
  const parts = value?.slice(0, 10).split('-');
  if (!parts || parts.length !== 3) return null;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day || !Number.isFinite(year + month + day)) return null;
  if (month < 1 || month > 12) return null;
  return [year, month, day];
}

/**
 * Date-only values are formatted by hand from their parts. `new Date('2026-01-15')`
 * parses as UTC midnight and then prints in the viewer's zone, which west of
 * UTC shows the day before — on a record whose whole claim is that its dates
 * are accurate, that is not a rounding error.
 */
export function formatDay(value: string | null): string | null {
  const parts = dateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Completion targets are a commitment to a quarter, not to a day. */
export function formatQuarter(value: string | null): string | null {
  const parts = dateParts(value);
  if (!parts) return null;
  const [year, month] = parts;
  return `Q${Math.floor((month - 1) / 3) + 1} ${year}`;
}

/**
 * Whole days from one date-only value to another, positive when `to` is later.
 * Both are read as UTC noon so that neither the viewer's zone nor a daylight
 * change can move the difference by a day.
 */
export function dayDiff(from: string | null, to: string | null): number | null {
  const a = dateParts(from);
  const b = dateParts(to);
  if (!a || !b) return null;
  const start = Date.UTC(a[0], a[1] - 1, a[2], 12);
  const end = Date.UTC(b[0], b[1] - 1, b[2], 12);
  return Math.round((end - start) / 86_400_000);
}

/**
 * When an entry was written into the record, to the minute, in West Africa
 * Time — the zone the record is kept in.
 *
 * `triggered_at` is an instant, so unlike the date-only columns it has to be
 * converted rather than read. It is converted by hand rather than through
 * `Intl`: WAT is a fixed UTC+1 with no daylight saving, and a fixed offset
 * gives the same string on every server, in every runtime, for all time —
 * which is what makes two readers of an archive agree about it.
 */
export function formatRecordedAt(value: string | null): string | null {
  if (!value) return null;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const wat = new Date(instant.getTime() + 60 * 60 * 1000);
  const day = wat.getUTCDate();
  const month = MONTHS[wat.getUTCMonth()];
  const hours = String(wat.getUTCHours()).padStart(2, '0');
  const minutes = String(wat.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${wat.getUTCFullYear()} · ${hours}:${minutes} WAT`;
}

/** CMS long copy is plain text; blank lines are its paragraph breaks. */
export function paragraphs(value: string | null): string[] {
  return (value ?? '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The title with its last word italicised, which is the house headline form. */
export function AccentedTitle({ title }: { title: string }): ReactElement {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return <>{title}</>;
  const accent = words[words.length - 1];
  return (
    <>
      {words.slice(0, -1).join(' ')} <em>{accent}</em>
    </>
  );
}
