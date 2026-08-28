#!/usr/bin/env tsx
import { ensureIndexes, isSearchConfigured, reindexAll } from '../src/lib/search/index';
import { pool } from '../src/lib/db';
import { logger } from '../src/lib/logger';

/**
 * Rebuilds every search index from PostgreSQL.
 *
 * Run after a bulk CMS import, after changing index settings, or to recover
 * from a Meilisearch data loss. The nightly worker job does the same thing.
 */
async function main(): Promise<void> {
  if (!isSearchConfigured()) {
    console.log('MEILISEARCH_URL is not set; search runs on PostgreSQL full-text. Nothing to do.');
    return;
  }

  await ensureIndexes();

  for (const index of ['projects', 'news', 'faqs'] as const) {
    const count = await reindexAll(index);
    console.log(`  ${index}: ${count} document(s) indexed`);
  }
}

main()
  .catch((error: unknown) => {
    logger.error('Reindex failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
