import type { PublicDocument } from '@/lib/repositories/documents';

/**
 * Server-side data for `/resources`: the published documents, read straight
 * from the repository so the page shows exactly what `/api/documents` returns.
 *
 * Never throws. With no database — including a build with none configured —
 * the page renders with an empty download centre that says so, and the next
 * revalidation picks the documents up. The same posture as
 * `app/home-projects.ts`.
 */

export type { PublicDocument };

export interface ResourcesData {
  documents: PublicDocument[];
  /** False when the documents could not be read, as opposed to there being none. */
  available: boolean;
}

export async function loadResources(): Promise<ResourcesData> {
  try {
    const repo = await import('@/lib/repositories/documents');
    return { documents: await repo.listPublished(), available: true };
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Documents unavailable; the download centre renders empty', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { documents: [], available: false };
  }
}
