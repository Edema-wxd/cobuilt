/**
 * Helpers shared by the video library's server pages and its client-side
 * filters. No server imports, so the browser bundle can use them.
 */

/** Where a video's page lives. */
export function videoHref(slug: string): string {
  return `/videos/${slug}`;
}

/**
 * The still a card or a player shows before anything is played: the editor's
 * thumbnail or the project's photograph (the API resolves which), else a house
 * still. Never YouTube's own thumbnail, which is a request to Google before
 * the visitor has chosen to watch anything (docs/decisions.md §2.23).
 */
export const HOUSE_STILL = '/images/construction-site.webp';

export function posterFor(video: { thumbnailUrl: string | null }): string {
  return video.thumbnailUrl ?? HOUSE_STILL;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar 2026", from a `YYYY-MM-DD` date's own calendar parts. */
export function formatMonth(value: string | null): string | null {
  const match = value ? /^(\d{4})-(\d{2})-\d{2}$/.exec(value) : null;
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : null;
}

/** Lower-cased text a search matches against: title, description, project. */
export function searchText(video: {
  title: string;
  description: string;
  project: { title: string } | null;
}): string {
  return `${video.title} ${video.description} ${video.project?.title ?? ''}`.toLowerCase();
}
