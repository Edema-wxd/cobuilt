import { cache } from 'react';

/**
 * Server-side data load for `/news/[slug]`.
 *
 * Lives apart from the page component because both the page and
 * `generateMetadata` need it. `cache` deduplicates the two calls within one
 * request, so a page render is still a single set of queries.
 *
 * It reads the repository directly rather than calling the API over HTTP, so
 * there is one round trip and the response shape is guaranteed by the same
 * serializers the API uses — the pattern established in
 * app/projects/[slug]/load-project.ts.
 */

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  featuredImageUrl: string | null;
  publishedAt: string | null;
}

export interface Article extends ArticleSummary {
  content: string;
  tags: string[];
  author: string | null;
  updatedAt: string | null;
  seo: { metaTitle: string | null; metaDescription: string | null };
}

export interface ArticleProps {
  article: Article;
  related: ArticleSummary[];
}

export type LoadResult =
  | { kind: 'found'; props: ArticleProps }
  | { kind: 'not-found' }
  /** No database, or it is down: the page renders its "couldn't be loaded" state. */
  | { kind: 'unavailable' };

export const loadArticle = cache(async (slug: string): Promise<LoadResult> => {
  if (!slug) return { kind: 'not-found' };

  // Imported here rather than at the top of the file: everything below reaches
  // PostgreSQL, and keeping the imports inside this function keeps the module
  // cheap for anything that only needs its types.
  const newsRepo = await import('@/lib/repositories/news');
  const { serializeNews, serializeNewsSummary } = await import('@/lib/serializers');

  try {
    const row = await newsRepo.findBySlug(slug);
    if (!row) return { kind: 'not-found' };

    const article = serializeNews(row);
    const related = (await newsRepo.related(article.id)).map(serializeNewsSummary);

    return { kind: 'found', props: { article, related } };
  } catch {
    // No database, or it is down. The page still renders and says so, rather
    // than returning a 500 — the same posture the projects pages take.
    return { kind: 'unavailable' };
  }
});
