import { query, queryOne } from '../db';
import type { NewsRow, Paginated } from '@/types/models';
import { paginate } from '@/types/models';
import type { CreateNewsBody, UpdateNewsBody } from '../schemas/news';
import { slugify, uniqueSlug } from '../slug';

/** News and press-release persistence. */

const COLUMNS = `
  n.id, n.title, n.slug, n.content, n.excerpt, n.author_id, n.category,
  n.featured_image_url, n.published_at, n.created_at, n.updated_at, n.deleted_at,
  n.meta_title, n.meta_description, n.tags,
  u.full_name AS author_name
`;

const FROM_CLAUSE = `FROM news_articles n LEFT JOIN users u ON u.id = n.author_id`;

export interface ListNewsOptions {
  category?: string;
  tag?: string;
  q?: string;
  page: number;
  pageSize: number;
  includeUnpublished?: boolean;
}

export async function list(options: ListNewsOptions): Promise<Paginated<NewsRow>> {
  const conditions = ['n.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (!options.includeUnpublished) {
    conditions.push('n.published_at IS NOT NULL', 'n.published_at <= NOW()');
  }

  if (options.category) {
    params.push(options.category);
    conditions.push(`n.category = $${params.length}`);
  }

  if (options.tag) {
    params.push(options.tag);
    conditions.push(`$${params.length} = ANY(n.tags)`);
  }

  if (options.q) {
    params.push(options.q);
    conditions.push(`n.search_vector @@ websearch_to_tsquery('english', $${params.length})`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize, offset);

  const { rows } = await query<NewsRow>(
    `SELECT ${COLUMNS} ${FROM_CLAUSE} ${where}
      ORDER BY n.published_at DESC NULLS LAST, n.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count ${FROM_CLAUSE} ${where}`,
    params.slice(0, -2),
  );

  return paginate(rows, Number(total?.count ?? 0), options.page, options.pageSize);
}

export async function findBySlug(
  slug: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<NewsRow | null> {
  const published = options.includeUnpublished
    ? ''
    : 'AND n.published_at IS NOT NULL AND n.published_at <= NOW()';

  return queryOne<NewsRow>(
    `SELECT ${COLUMNS} ${FROM_CLAUSE}
      WHERE n.slug = $1 AND n.deleted_at IS NULL ${published}`,
    [slug],
  );
}

export async function findById(
  id: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<NewsRow | null> {
  const published = options.includeUnpublished
    ? ''
    : 'AND n.published_at IS NOT NULL AND n.published_at <= NOW()';

  return queryOne<NewsRow>(
    `SELECT ${COLUMNS} ${FROM_CLAUSE}
      WHERE n.id = $1 AND n.deleted_at IS NULL ${published}`,
    [id],
  );
}

/**
 * Articles related to `articleId`, by shared tags then same category.
 *
 * Ranked by how many tags overlap so an article sharing three tags outranks
 * one sharing a single tag; category matches fill any remaining slots.
 */
export async function related(articleId: string, limit = 3): Promise<NewsRow[]> {
  const { rows } = await query<NewsRow>(
    `WITH source AS (
       SELECT tags, category FROM news_articles WHERE id = $1
     )
     SELECT ${COLUMNS},
            cardinality(ARRAY(SELECT unnest(n.tags) INTERSECT SELECT unnest(source.tags))) AS shared_tags
       ${FROM_CLAUSE}, source
      WHERE n.id <> $1
        AND n.deleted_at IS NULL
        AND n.published_at IS NOT NULL AND n.published_at <= NOW()
        AND (n.tags && source.tags OR n.category = source.category)
      ORDER BY shared_tags DESC, n.published_at DESC
      LIMIT $2`,
    [articleId, limit],
  );

  return rows;
}

export async function create(
  input: CreateNewsBody,
  authorId: string | null,
): Promise<NewsRow> {
  const slug = await uniqueSlug('news_articles', input.slug ?? slugify(input.title));

  const row = await queryOne<{ id: string }>(
    `INSERT INTO news_articles (
       title, slug, content, excerpt, author_id, category,
       featured_image_url, published_at, meta_title, meta_description, tags
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      input.title,
      slug,
      input.content,
      input.excerpt ?? null,
      input.authorId ?? authorId,
      input.category ?? null,
      input.featuredImageUrl ?? null,
      input.publishedAt ?? null,
      input.metaTitle ?? null,
      input.metaDescription ?? null,
      input.tags ?? [],
    ],
  );

  return (await findById(row!.id, { includeUnpublished: true }))!;
}

const UPDATABLE_COLUMNS: Record<string, string> = {
  title: 'title',
  slug: 'slug',
  content: 'content',
  excerpt: 'excerpt',
  category: 'category',
  featuredImageUrl: 'featured_image_url',
  tags: 'tags',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
  publishedAt: 'published_at',
  authorId: 'author_id',
};

export async function update(id: string, input: UpdateNewsBody): Promise<NewsRow | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return findById(id, { includeUnpublished: true });

  params.push(id);
  await query(
    `UPDATE news_articles SET ${assignments.join(', ')}
      WHERE id = $${params.length} AND deleted_at IS NULL`,
    params,
  );

  return findById(id, { includeUnpublished: true });
}

export async function softDelete(id: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE news_articles SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rowCount > 0;
}

export async function allPublishedSlugs(): Promise<string[]> {
  const { rows } = await query<{ slug: string }>(
    `SELECT slug FROM news_articles
      WHERE deleted_at IS NULL AND published_at IS NOT NULL AND published_at <= NOW()
      ORDER BY published_at DESC`,
  );
  return rows.map((r) => r.slug);
}
