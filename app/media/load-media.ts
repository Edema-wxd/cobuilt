import {
  NEWS_CATEGORIES,
  isNewsCategory,
  normalizeNewsCategory,
  type NewsCategory,
} from '@/lib/news-categories';

/** How many of each category's newest articles the media centre shows. */
export const PER_CATEGORY = 3;

export interface MediaArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  /** Canonical where it is one of the five; a CMS category of its own as sent. */
  category: string | null;
  /** Already formatted on the server, e.g. "02 Sep 2026". */
  published: string | null;
  image: string | null;
}

export interface MediaCategoryGroup {
  /**
   * One of the spec's five categories, or null for everything else: articles
   * with no category, or with one the CMS sent of its own.
   */
  category: NewsCategory | null;
  /** Newest first, at most `PER_CATEGORY`. Never empty. */
  articles: MediaArticle[];
}

const published = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  // The office's zone, as on the landing page (app/home-news.ts): one string
  // for every reader, and nothing for hydration to disagree with.
  timeZone: 'Africa/Lagos',
});

/**
 * The media centre's "latest by category" rows: the newest published articles
 * in each of the five categories, in the spec's order, then the rest. A
 * category with nothing published is left out rather than shown empty.
 *
 * Reads the repository directly, as the landing page's loaders do, so drafts,
 * scheduled and deleted articles are excluded by the same query that excludes
 * them from /api/news. Returns an empty list rather than throwing when the
 * database cannot be reached, so the build and an outage both render the page,
 * with its empty state, and the next regeneration picks the articles up.
 */
export async function loadMediaCentre(): Promise<MediaCategoryGroup[]> {
  try {
    const news = await import('@/lib/repositories/news');
    // Newest first across every category, at most PER_CATEGORY per stored value.
    const rows = await news.latestPerCategory(PER_CATEGORY);

    const groups = new Map<NewsCategory | null, MediaArticle[]>();
    for (const row of rows) {
      const category = normalizeNewsCategory(row.category);
      const key = isNewsCategory(category) ? category : null;
      const articles = groups.get(key) ?? [];
      // Two stored spellings, or several CMS categories, can share one group;
      // the rows arrive newest first, so the cut keeps the newest.
      if (articles.length >= PER_CATEGORY) continue;

      articles.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        category,
        published: row.published_at ? published.format(new Date(row.published_at)) : null,
        image: row.featured_image_url,
      });
      groups.set(key, articles);
    }

    return [...NEWS_CATEGORIES, null].flatMap((category) => {
      const articles = groups.get(category);
      return articles ? [{ category, articles }] : [];
    });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Media centre articles unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
