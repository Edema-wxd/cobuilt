import { cache } from 'react';
import type { PublicLeader } from '@/lib/serializers';

/**
 * Server-side data loads for `/leadership` and `/leadership/[slug]`.
 *
 * They read the repository directly rather than calling /api/leadership over
 * HTTP, so the shape is the one the API serves (`serializeLeader`). The
 * repository imports sit inside each function, the pattern of
 * app/home-projects.ts: a build with no database still renders these pages.
 */

export type { PublicLeader };

/**
 * Published leaders in editorial order; `featured` narrows to the homepage
 * spotlight. Returns an empty list rather than throwing when the database
 * cannot be reached, so the page renders its "profiles pending" state and the
 * next revalidation picks the profiles up.
 */
export async function loadPublishedLeaders(
  options: { featured?: boolean; limit?: number } = {},
): Promise<PublicLeader[]> {
  try {
    const leadership = await import('@/lib/repositories/leadership');
    const { serializeLeader } = await import('@/lib/serializers');
    return (await leadership.listPublishedLeadership(options)).map(serializeLeader);
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Leadership profiles unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export type LeaderResult =
  | { kind: 'found'; leader: PublicLeader }
  | { kind: 'not-found' }
  /** No database, or it is down: the page renders its "couldn't be loaded" state. */
  | { kind: 'unavailable' };

/** One published leader. `cache` shares the load between the page and its metadata. */
export const loadLeader = cache(async (slug: string): Promise<LeaderResult> => {
  if (!slug) return { kind: 'not-found' };
  try {
    const leadership = await import('@/lib/repositories/leadership');
    const { serializeLeader } = await import('@/lib/serializers');
    const row = await leadership.getLeaderBySlug(slug);
    return row ? { kind: 'found', leader: serializeLeader(row) } : { kind: 'not-found' };
  } catch {
    return { kind: 'unavailable' };
  }
});
