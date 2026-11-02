import { cache } from 'react';
import type {
  GalleryAlbum,
  GalleryAlbumSummary,
  GalleryFacets,
} from '@/lib/repositories/gallery';

/**
 * Server-side data for `/gallery` and `/gallery/[slug]`.
 *
 * Reads the repository directly rather than `/api/gallery` over HTTP, so the
 * pages see exactly what the API returns, in one round trip. When the database
 * cannot be reached — including during a build with none configured — the
 * pages render a "couldn't be loaded" state rather than failing, and the next
 * revalidation picks the gallery up. The same posture as `app/home-projects.ts`;
 * unlike services there is no built-in copy to fall back to, because there is
 * no photography to invent.
 */

export type { GalleryAlbum, GalleryAlbumSummary, GalleryFacets };

export type GalleryIndexData =
  | { kind: 'ready'; albums: GalleryAlbumSummary[]; facets: GalleryFacets }
  | { kind: 'unavailable' };

export type AlbumLoad =
  | { kind: 'found'; album: GalleryAlbum }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

async function warnUnavailable(error: unknown): Promise<void> {
  const { logger } = await import('@/lib/logger');
  logger.warn('Gallery unavailable', {
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Every published album, in display order, with the filters' options. The
 * page filters in the browser: a gallery is tens of albums, not thousands, and
 * one prerendered page that filters instantly beats a request per filter.
 */
export const loadGalleryIndex = cache(async (): Promise<GalleryIndexData> => {
  try {
    const repo = await import('@/lib/repositories/gallery');
    const [page, facets] = await Promise.all([repo.listPublished(), repo.publishedFacets()]);
    return { kind: 'ready', albums: page.results, facets };
  } catch (error) {
    await warnUnavailable(error);
    return { kind: 'unavailable' };
  }
});

/** `cache` lets the page, its metadata and its share image share one load. */
export const loadAlbum = cache(async (slug: string): Promise<AlbumLoad> => {
  try {
    const repo = await import('@/lib/repositories/gallery');
    const album = await repo.findPublishedBySlug(slug);
    return album ? { kind: 'found', album } : { kind: 'not-found' };
  } catch (error) {
    await warnUnavailable(error);
    return { kind: 'unavailable' };
  }
});

/** Slugs to prerender at build time; none without a database, and each renders on first request. */
export async function albumSlugs(): Promise<Array<{ slug: string }>> {
  try {
    const repo = await import('@/lib/repositories/gallery');
    return (await repo.publishedSlugs()).map((slug) => ({ slug }));
  } catch (error) {
    await warnUnavailable(error);
    return [];
  }
}
