import { normalizeNewsCategory } from '@/lib/news-categories';
import type { HomeArticle } from './home-page';

/** How many of the most recent articles the landing page shows. */
const LIMIT = 3;

const published = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  // Formatted here, on the server, in the office's zone: the same string for
  // every reader, and nothing for hydration to disagree with.
  timeZone: 'Africa/Lagos',
});

/**
 * The landing page's "Latest news" cards: the most recently published
 * articles, newest first, read through the same repository as /api/news.
 *
 * Returns an empty list rather than throwing when the database cannot be
 * reached, and the page leaves the section out, so the build and a fresh
 * database both render cleanly.
 */
export async function loadHomeNews(): Promise<HomeArticle[]> {
  try {
    const news = await import('@/lib/repositories/news');
    const page = await news.list({ page: 1, pageSize: LIMIT });

    return page.results.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      category: normalizeNewsCategory(row.category),
      published: row.published_at ? published.format(new Date(row.published_at)) : null,
      image: row.featured_image_url,
    }));
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Landing page news unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
