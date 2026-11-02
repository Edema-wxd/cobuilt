/**
 * Video library vocabulary, shared by the API, the public pages and the
 * console.
 *
 * Pure, with no server imports, like `./youtube.ts`: the admin form and the
 * library's filters use the same categories and the same duration rule as the
 * API that stores them.
 */

/** The client's categories, in the order the library's filter shows them. */
export const VIDEO_CATEGORIES = [
  'project_documentary',
  'construction_update',
  'drone',
  'leadership_interview',
  'educational',
  'corporate',
  'event_highlights',
] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

/** One film: the card's kicker. */
export const VIDEO_CATEGORY_LABEL: Record<VideoCategory, string> = {
  project_documentary: 'Project documentary',
  construction_update: 'Construction update',
  drone: 'Drone video',
  leadership_interview: 'Leadership interview',
  educational: 'Educational',
  corporate: 'Corporate video',
  event_highlights: 'Event highlights',
};

/** Several films: the filter's options. */
export const VIDEO_CATEGORY_PLURAL: Record<VideoCategory, string> = {
  project_documentary: 'Project documentaries',
  construction_update: 'Construction updates',
  drone: 'Drone videos',
  leadership_interview: 'Leadership interviews',
  educational: 'Educational',
  corporate: 'Corporate videos',
  event_highlights: 'Event highlights',
};

export function isVideoCategory(value: unknown): value is VideoCategory {
  return typeof value === 'string' && (VIDEO_CATEGORIES as readonly string[]).includes(value);
}

/** "6:42", or "1:02:05" past the hour. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Seconds from what an editor types: "6:42", "1:02:05" or a bare number of
 * seconds. Null for blank, undefined for anything that is not a duration.
 */
export function parseDuration(value: string): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{1,3}(:\d{2}){1,2}$/.test(text) && !/^\d{1,5}$/.test(text)) return undefined;

  const parts = text.split(':').map(Number);
  if (parts.slice(1).some((part) => part >= 60)) return undefined;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds > 0 ? seconds : undefined;
}

/** The duration as a screen reader should say it: "6 minutes 42 seconds". */
export function spokenDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return parts.join(' ');
}
