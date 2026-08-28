import { query } from '../db';
import type { SearchHit, SearchOptions } from './types';

/**
 * PostgreSQL full-text search: the fallback when Meilisearch is unavailable,
 * and the only search backend needed for a small corpus.
 *
 * `websearch_to_tsquery` is used rather than `plainto_tsquery` so quoted
 * phrases and `-exclusions` in the query box behave the way users expect. It
 * also cannot raise a syntax error on arbitrary input, which `to_tsquery` can.
 */

export async function searchProjects(options: SearchOptions): Promise<SearchHit[]> {
  const conditions = [
    'p.deleted_at IS NULL',
    'p.published_at IS NOT NULL',
    'p.published_at <= NOW()',
  ];
  const params: unknown[] = [options.q];

  if (options.q) {
    conditions.push(`p.search_vector @@ websearch_to_tsquery('english', $1)`);
  }

  if (options.filters?.status) {
    params.push(options.filters.status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (options.filters?.sector) {
    params.push(options.filters.sector);
    conditions.push(`s.slug = $${params.length}`);
  }

  params.push(options.limit, options.offset);

  const { rows } = await query<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    published_at: Date | null;
    rank: number;
  }>(
    `SELECT p.id, p.title, p.slug, p.description AS excerpt, p.published_at,
            ts_rank(p.search_vector, websearch_to_tsquery('english', $1)) AS rank
       FROM projects p
       LEFT JOIN sectors s ON s.id = p.sector_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC, p.published_at DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    type: 'project' as const,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    url: `/projects/${row.slug}`,
    publishedAt: row.published_at,
    score: Number(row.rank),
  }));
}

export async function searchNews(options: SearchOptions): Promise<SearchHit[]> {
  const conditions = [
    'deleted_at IS NULL',
    'published_at IS NOT NULL',
    'published_at <= NOW()',
  ];
  const params: unknown[] = [options.q];

  if (options.q) {
    conditions.push(`search_vector @@ websearch_to_tsquery('english', $1)`);
  }
  if (options.filters?.category) {
    params.push(options.filters.category);
    conditions.push(`category = $${params.length}`);
  }

  params.push(options.limit, options.offset);

  const { rows } = await query<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    published_at: Date | null;
    rank: number;
  }>(
    `SELECT id, title, slug, excerpt, published_at,
            ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank
       FROM news_articles
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC, published_at DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    type: 'news' as const,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    url: `/news/${row.slug}`,
    publishedAt: row.published_at,
    score: Number(row.rank),
  }));
}

export async function searchFaqs(options: SearchOptions): Promise<SearchHit[]> {
  const conditions = ['published = TRUE'];
  const params: unknown[] = [options.q];

  if (options.q) {
    conditions.push(`search_vector @@ websearch_to_tsquery('english', $1)`);
  }

  params.push(options.limit, options.offset);

  const { rows } = await query<{
    id: string;
    question: string;
    answer: string;
    rank: number;
  }>(
    `SELECT id, question, answer,
            ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank
       FROM faqs
      WHERE ${conditions.join(' AND ')}
      ORDER BY rank DESC, sort_order ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    type: 'faq' as const,
    title: row.question,
    slug: row.id,
    excerpt: row.answer.slice(0, 200),
    url: `/faqs#${row.id}`,
    publishedAt: null,
    score: Number(row.rank),
  }));
}

/**
 * Autocomplete suggestions.
 *
 * Trigram matching rather than tsquery, because a user three characters into a
 * word has not typed a complete lexeme yet and full-text matching returns
 * nothing. `word_similarity` (the `<%` operator) rather than plain
 * `similarity`: the latter compares the whole title against the whole term, so
 * "waterfr" against "Waterfront Commercial Tower" scores 0.24 and falls under
 * the 0.3 threshold. word_similarity scores the term against the best-matching
 * word in the title, which is the behaviour a search box needs.
 */
export async function autocomplete(term: string, limit: number): Promise<SearchHit[]> {
  const { rows } = await query<{
    id: string;
    title: string;
    slug: string;
    type: string;
    similarity: number;
  }>(
    `(SELECT id, title, slug, 'project' AS type, word_similarity($1, title) AS similarity
        FROM projects
       WHERE deleted_at IS NULL AND published_at IS NOT NULL AND published_at <= NOW()
         AND $1 <% title
       ORDER BY similarity DESC LIMIT $2)
     UNION ALL
     (SELECT id, title, slug, 'news' AS type, word_similarity($1, title) AS similarity
        FROM news_articles
       WHERE deleted_at IS NULL AND published_at IS NOT NULL AND published_at <= NOW()
         AND $1 <% title
       ORDER BY similarity DESC LIMIT $2)
     ORDER BY similarity DESC
     LIMIT $2`,
    [term, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type as SearchHit['type'],
    title: row.title,
    slug: row.slug,
    excerpt: null,
    url: row.type === 'project' ? `/projects/${row.slug}` : `/news/${row.slug}`,
    publishedAt: null,
    score: Number(row.similarity),
  }));
}

export async function countMatches(
  index: 'projects' | 'news' | 'faqs',
  q: string | undefined,
): Promise<number> {
  const table = { projects: 'projects', news: 'news_articles', faqs: 'faqs' }[index];
  const live =
    index === 'faqs'
      ? 'published = TRUE'
      : 'deleted_at IS NULL AND published_at IS NOT NULL AND published_at <= NOW()';

  const filter = q ? `AND search_vector @@ websearch_to_tsquery('english', $1)` : '';

  const { rows } = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table} WHERE ${live} ${filter}`,
    q ? [q] : [],
  );

  return Number(rows[0]?.count ?? 0);
}
