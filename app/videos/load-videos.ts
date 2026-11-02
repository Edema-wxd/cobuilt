import { cache } from 'react';
import type { PublicVideo, VideoProject } from '@/lib/repositories/videos';
import type { VideoCategory } from '@/lib/videos';

/**
 * Server-side data for `/videos`, `/videos/[slug]` and the leadership page's
 * video library band.
 *
 * Reads the repository directly rather than `/api/videos` over HTTP, so the
 * pages see exactly what the API returns, in one round trip. The repository
 * import sits inside each function, the pattern of app/home-projects.ts: a
 * build with no database still renders these pages, and the next
 * revalidation picks the library up.
 */

export type { PublicVideo, VideoProject };

async function warnUnavailable(error: unknown): Promise<void> {
  const { logger } = await import('@/lib/logger');
  logger.warn('Video library unavailable', {
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Every published video in display order, or null when the database cannot be
 * reached — which the page says plainly, rather than claiming the library is
 * empty.
 */
export const loadLibrary = cache(async (): Promise<PublicVideo[] | null> => {
  try {
    const repo = await import('@/lib/repositories/videos');
    return await repo.listAllPublished();
  } catch (error) {
    await warnUnavailable(error);
    return null;
  }
});

export type VideoPageResult =
  | { kind: 'found'; video: PublicVideo; related: PublicVideo[] }
  | { kind: 'not-found' }
  /** No database, or it is down: the page renders its "couldn't be loaded" state. */
  | { kind: 'unavailable' };

/** One published video and what to watch next. `cache` shares the load with the metadata. */
export const loadVideoPage = cache(async (slug: string): Promise<VideoPageResult> => {
  if (!slug) return { kind: 'not-found' };
  try {
    const repo = await import('@/lib/repositories/videos');
    const video = await repo.findPublishedBySlug(slug);
    if (!video) return { kind: 'not-found' };
    return { kind: 'found', video, related: await repo.relatedTo(video) };
  } catch (error) {
    await warnUnavailable(error);
    return { kind: 'unavailable' };
  }
});

/** The latest published films in a category; empty when there are none or no database. */
export async function loadLatest(category: VideoCategory, limit = 3): Promise<PublicVideo[]> {
  try {
    const repo = await import('@/lib/repositories/videos');
    return await repo.latestInCategory(category, limit);
  } catch (error) {
    await warnUnavailable(error);
    return [];
  }
}
