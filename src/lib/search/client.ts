import { Meilisearch } from 'meilisearch';
import { env } from '../env';
import { logger } from '../logger';

/**
 * Meilisearch client (§6).
 *
 * Meilisearch is optional infrastructure: when MEILISEARCH_URL is unset, or
 * the service is unreachable, search falls back to PostgreSQL full-text
 * (./postgres.ts). The site must stay searchable during a search outage.
 */

declare global {
  var __cobuiltMeili: Meilisearch | undefined;
}

export const INDEXES = {
  projects: 'projects',
  news: 'news',
  faqs: 'faqs',
} as const;

export type IndexName = keyof typeof INDEXES;

export function meili(): Meilisearch | null {
  if (!env.MEILISEARCH_URL) return null;

  globalThis.__cobuiltMeili ??= new Meilisearch({
    host: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_KEY,
    timeout: 5_000,
  });

  return globalThis.__cobuiltMeili;
}

export function isSearchConfigured(): boolean {
  return Boolean(env.MEILISEARCH_URL);
}

export async function checkSearch(): Promise<boolean> {
  const client = meili();
  if (!client) return false;

  try {
    const health = await client.health();
    return health.status === 'available';
  } catch {
    return false;
  }
}

/**
 * Creates the indexes and applies their settings. Idempotent, so it is safe to
 * run on every deploy.
 */
export async function ensureIndexes(): Promise<void> {
  const client = meili();
  if (!client) {
    logger.info('Meilisearch not configured; skipping index setup');
    return;
  }

  await configureIndex(client, INDEXES.projects, {
    searchableAttributes: ['title', 'description', 'longDescription', 'locationName', 'sectorName'],
    filterableAttributes: ['status', 'projectType', 'sector', 'location', 'tags', 'publishedAt'],
    sortableAttributes: ['publishedAt', 'title'],
    // Title matches should outrank a mention buried in the body copy.
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
  });

  await configureIndex(client, INDEXES.news, {
    searchableAttributes: ['title', 'excerpt', 'content'],
    filterableAttributes: ['category', 'tags', 'publishedAt'],
    sortableAttributes: ['publishedAt', 'title'],
  });

  await configureIndex(client, INDEXES.faqs, {
    searchableAttributes: ['question', 'answer'],
    filterableAttributes: ['category'],
  });
}

async function configureIndex(
  client: Meilisearch,
  uid: string,
  settings: Record<string, unknown>,
): Promise<void> {
  try {
    await client.createIndex(uid, { primaryKey: 'id' });
  } catch {
    // Already exists — the settings update below is what matters.
  }
  await client.index(uid).updateSettings(settings);
}
