import { logger } from '../logger';
import { query } from '../db';
import type { NewsRow, ProjectRow } from '@/types/models';
import { INDEXES, type IndexName, isSearchConfigured, meili } from './client';
import * as pg from './postgres';
import type { SearchHit, SearchResponse } from './types';

export * from './types';
export { checkSearch, ensureIndexes, isSearchConfigured } from './client';

/**
 * The search facade every route uses.
 *
 * It tries Meilisearch and falls back to PostgreSQL on any failure, reporting
 * which engine answered so a silent degradation shows up in the response and
 * in logs rather than as "search got worse" three weeks later.
 */

export interface SiteSearchOptions {
  q: string;
  type?: 'project' | 'news' | 'faq';
  page: number;
  pageSize: number;
  filters?: { status?: string; sector?: string; location?: string; category?: string };
}

export async function siteSearch(options: SiteSearchOptions): Promise<SearchResponse> {
  const offset = (options.page - 1) * options.pageSize;

  if (isSearchConfigured()) {
    try {
      return await meiliSearch(options, offset);
    } catch (error) {
      logger.warn('Meilisearch query failed; falling back to PostgreSQL', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return postgresSearch(options, offset);
}

async function meiliSearch(
  options: SiteSearchOptions,
  offset: number,
): Promise<SearchResponse> {
  const client = meili();
  if (!client) throw new Error('Meilisearch not configured');

  const targets: IndexName[] = options.type
    ? [typeToIndex(options.type)]
    : ['projects', 'news', 'faqs'];

  const responses = await Promise.all(
    targets.map((index) =>
      client
        .index(INDEXES[index])
        .search(options.q, {
          limit: options.pageSize,
          offset,
          filter: buildFilter(index, options.filters),
        })
        .then((result: { hits: unknown[]; estimatedTotalHits?: number }) => ({ index, result })),
    ),
  );

  const results: SearchHit[] = [];
  let total = 0;

  for (const { index, result } of responses) {
    total += result.estimatedTotalHits ?? result.hits.length;
    for (const hit of result.hits) {
      results.push(toHit(index, hit as Record<string, unknown>));
    }
  }

  // Merging several indexes loses Meilisearch's per-index ordering, so the
  // combined list is re-sorted by its own ranking score.
  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, options.pageSize),
    total,
    page: options.page,
    pageSize: options.pageSize,
    engine: 'meilisearch',
  };
}

async function postgresSearch(
  options: SiteSearchOptions,
  offset: number,
): Promise<SearchResponse> {
  const searchOptions = {
    q: options.q,
    limit: options.pageSize,
    offset,
    filters: options.filters,
  };

  const wanted = options.type ?? 'all';
  const [projects, news, faqs] = await Promise.all([
    wanted === 'all' || wanted === 'project' ? pg.searchProjects(searchOptions) : [],
    wanted === 'all' || wanted === 'news' ? pg.searchNews(searchOptions) : [],
    wanted === 'all' || wanted === 'faq' ? pg.searchFaqs(searchOptions) : [],
  ]);

  const [projectCount, newsCount, faqCount] = await Promise.all([
    wanted === 'all' || wanted === 'project' ? pg.countMatches('projects', options.q) : 0,
    wanted === 'all' || wanted === 'news' ? pg.countMatches('news', options.q) : 0,
    wanted === 'all' || wanted === 'faq' ? pg.countMatches('faqs', options.q) : 0,
  ]);

  const results = [...projects, ...news, ...faqs].sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, options.pageSize),
    total: projectCount + newsCount + faqCount,
    page: options.page,
    pageSize: options.pageSize,
    engine: 'postgres',
  };
}

export async function autocomplete(term: string, limit = 8): Promise<SearchHit[]> {
  if (isSearchConfigured()) {
    try {
      const client = meili();
      const result = await client!.index(INDEXES.projects).search(term, { limit });
      return result.hits.map((hit: unknown) => toHit('projects', hit as Record<string, unknown>));
    } catch (error) {
      logger.warn('Meilisearch autocomplete failed; falling back', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return pg.autocomplete(term, limit);
}

// --- Indexing ------------------------------------------------------------

export async function indexProject(project: ProjectRow): Promise<void> {
  const client = meili();
  if (!client) return;

  // Unpublished and deleted projects must not be searchable.
  if (project.deleted_at || !project.published_at) {
    await removeDocument('projects', project.id);
    return;
  }

  await client.index(INDEXES.projects).addDocuments([
    {
      id: project.id,
      title: project.title,
      slug: project.slug,
      description: project.description,
      longDescription: project.long_description,
      status: project.status,
      sector: project.sector_name ?? null,
      location: project.location_name ?? null,
      projectType: project.project_type_name ?? null,
      publishedAt: project.published_at ? new Date(project.published_at).getTime() : null,
    },
  ]);
}

export async function indexNews(article: NewsRow): Promise<void> {
  const client = meili();
  if (!client) return;

  if (article.deleted_at || !article.published_at) {
    await removeDocument('news', article.id);
    return;
  }

  await client.index(INDEXES.news).addDocuments([
    {
      id: article.id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      tags: article.tags,
      publishedAt: article.published_at ? new Date(article.published_at).getTime() : null,
    },
  ]);
}

export async function removeDocument(index: IndexName, id: string): Promise<void> {
  const client = meili();
  if (!client) return;
  await client.index(INDEXES[index]).deleteDocument(id);
}

/** Full rebuild, run nightly (§6) and after a bulk CMS import. */
export async function reindexAll(index: IndexName): Promise<number> {
  const client = meili();
  if (!client) return 0;

  const documents = await loadIndexDocuments(index);
  if (documents.length === 0) return 0;

  await client.index(INDEXES[index]).addDocuments(documents);
  return documents.length;
}

async function loadIndexDocuments(index: IndexName): Promise<Record<string, unknown>[]> {
  if (index === 'projects') {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT p.id, p.title, p.slug, p.description, p.long_description AS "longDescription",
              p.status::text AS status, s.name AS sector, l.name AS location,
              pt.name AS "projectType",
              extract(epoch FROM p.published_at) * 1000 AS "publishedAt"
         FROM projects p
         LEFT JOIN sectors s ON s.id = p.sector_id
         LEFT JOIN locations l ON l.id = p.location_id
         LEFT JOIN project_types pt ON pt.id = p.project_type_id
        WHERE p.deleted_at IS NULL AND p.published_at IS NOT NULL AND p.published_at <= NOW()`,
    );
    return rows;
  }

  if (index === 'news') {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT id, title, slug, excerpt, content, category, tags,
              extract(epoch FROM published_at) * 1000 AS "publishedAt"
         FROM news_articles
        WHERE deleted_at IS NULL AND published_at IS NOT NULL AND published_at <= NOW()`,
    );
    return rows;
  }

  const { rows } = await query<Record<string, unknown>>(
    `SELECT id, question, answer, category FROM faqs WHERE published = TRUE`,
  );
  return rows;
}

function typeToIndex(type: 'project' | 'news' | 'faq'): IndexName {
  return type === 'project' ? 'projects' : type === 'news' ? 'news' : 'faqs';
}

function buildFilter(
  index: IndexName,
  filters: SiteSearchOptions['filters'],
): string | undefined {
  if (!filters) return undefined;

  const clauses: string[] = [];

  if (index === 'projects') {
    if (filters.status) clauses.push(`status = "${escapeFilter(filters.status)}"`);
    if (filters.sector) clauses.push(`sector = "${escapeFilter(filters.sector)}"`);
    if (filters.location) clauses.push(`location = "${escapeFilter(filters.location)}"`);
  } else if (index === 'news' && filters.category) {
    clauses.push(`category = "${escapeFilter(filters.category)}"`);
  }

  return clauses.length > 0 ? clauses.join(' AND ') : undefined;
}

/** Meilisearch filter values are quoted strings; a quote would break out. */
function escapeFilter(value: string): string {
  return value.replace(/["\\]/g, '');
}

/** Meilisearch documents are untyped, so every field is coerced defensively. */
function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function toHit(index: IndexName, hit: Record<string, unknown>): SearchHit {
  const id = asString(hit.id);
  const slug = asString(hit.slug, id);

  if (index === 'faqs') {
    return {
      id,
      type: 'faq',
      title: asString(hit.question),
      slug: id,
      excerpt: typeof hit.answer === 'string' ? hit.answer.slice(0, 200) : null,
      url: `/faqs#${id}`,
      publishedAt: null,
      score: typeof hit._rankingScore === 'number' ? hit._rankingScore : 0.5,
    };
  }

  const type = index === 'projects' ? 'project' : 'news';

  return {
    id,
    type,
    title: asString(hit.title),
    slug,
    excerpt:
      typeof hit.description === 'string'
        ? hit.description
        : typeof hit.excerpt === 'string'
          ? hit.excerpt
          : null,
    url: type === 'project' ? `/projects/${slug}` : `/news/${slug}`,
    publishedAt: typeof hit.publishedAt === 'number' ? new Date(hit.publishedAt) : null,
    score: typeof hit._rankingScore === 'number' ? hit._rankingScore : 0.5,
  };
}
