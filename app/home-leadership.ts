import type { HomeLeader } from './home-page';

/** The spotlight is a glimpse; /leadership carries everyone. */
const LIMIT = 3;

/** Long enough for a sentence or two of a biography, short enough for a card. */
const SUMMARY_CHARS = 180;

/**
 * The landing page's leadership spotlight: the profiles an editor marked for
 * it (the "Spotlight" toggle in /admin/leadership), in their editorial order.
 * Until anyone is marked, it shows the first published profiles instead, so
 * publishing leaders is enough to fill the band.
 *
 * Reads through the leadership repository, the same rows /leadership shows.
 * The card prefers the profile's own short summary and falls back to the
 * opening of the biography.
 *
 * Returns an empty list rather than throwing when the database cannot be
 * reached, and the page leaves the section out.
 */
export async function loadHomeLeaders(): Promise<HomeLeader[]> {
  try {
    const leadership = await import('@/lib/repositories/leadership');
    const featured = await leadership.listPublishedLeadership({ featured: true, limit: LIMIT });
    const rows =
      featured.length > 0 ? featured : await leadership.listPublishedLeadership({ limit: LIMIT });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.full_name,
      role: row.role_title,
      summary: row.summary?.trim() || summarise(row.bio),
      photo: row.photo_url,
    }));
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Landing page leadership unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * The biography's opening, cut at a sentence or a word boundary. Biographies
 * are CMS text, so tags are dropped and paragraph breaks collapse to spaces.
 */
export function summarise(bio: string | null): string | null {
  const text = (bio ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length <= SUMMARY_CHARS) return text;

  const cut = text.slice(0, SUMMARY_CHARS);
  const sentence = cut.lastIndexOf('. ');
  if (sentence > SUMMARY_CHARS / 2) return cut.slice(0, sentence + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—-]+$/, '')}…`;
}
