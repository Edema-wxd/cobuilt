import type { HomeLeader } from './home-page';

/** The spotlight is a glimpse; /leadership carries everyone. */
const LIMIT = 3;

/** Long enough for a sentence or two of a biography, short enough for a card. */
const SUMMARY_CHARS = 180;

/**
 * The landing page's leadership spotlight: published profiles in their
 * editorial order.
 *
 * This reads the `leadership` table directly, using only the columns it has
 * had since migration 0007. A leadership repository is being added
 * separately; when it lands, swap the query below for its published-list
 * call and keep the mapping.
 *
 * Returns an empty list rather than throwing when the database cannot be
 * reached, and the page leaves the section out.
 */
export async function loadHomeLeaders(): Promise<HomeLeader[]> {
  try {
    const { query } = await import('@/lib/db');
    const { rows } = await query<{
      id: string;
      full_name: string;
      slug: string;
      role_title: string | null;
      bio: string | null;
      photo_url: string | null;
    }>(
      `SELECT id, full_name, slug, role_title, bio, photo_url
         FROM leadership
        WHERE published = TRUE
        ORDER BY sort_order ASC, full_name ASC
        LIMIT $1`,
      [LIMIT],
    );

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.full_name,
      role: row.role_title,
      summary: summarise(row.bio),
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
