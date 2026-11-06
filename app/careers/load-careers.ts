import { cache } from 'react';
import type { PublicVacancy } from '@/lib/repositories/vacancies';

/**
 * Server-side data for `/careers` and `/careers/[slug]`: the vacancies, read
 * straight from the repository so the pages show exactly what
 * `/api/vacancies` returns.
 *
 * Never throws. With no database — including a build with none configured —
 * `/careers` renders with no vacancies listed and says they could not be
 * loaded, and a vacancy's page says the same rather than answering 404 for a
 * role that may well exist. The next revalidation picks them up. The same
 * posture as `app/home-projects.ts` and the gallery.
 */

export type { PublicVacancy };

export type CareersData = { kind: 'ready'; vacancies: PublicVacancy[] } | { kind: 'unavailable' };

export type VacancyLoad =
  | { kind: 'found'; vacancy: PublicVacancy }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

async function warnUnavailable(error: unknown): Promise<void> {
  const { logger } = await import('@/lib/logger');
  logger.warn('Vacancies unavailable', {
    error: error instanceof Error ? error.message : String(error),
  });
}

/** The vacancies taking applications, in the console's order. */
export const loadOpenVacancies = cache(async (): Promise<CareersData> => {
  try {
    const repo = await import('@/lib/repositories/vacancies');
    return { kind: 'ready', vacancies: await repo.listOpen() };
  } catch (error) {
    await warnUnavailable(error);
    return { kind: 'unavailable' };
  }
});

/** A published vacancy, open or closed. `cache` lets the page and its metadata share one read. */
export const loadVacancy = cache(async (slug: string): Promise<VacancyLoad> => {
  try {
    const repo = await import('@/lib/repositories/vacancies');
    const vacancy = await repo.findPublishedBySlug(slug);
    return vacancy ? { kind: 'found', vacancy } : { kind: 'not-found' };
  } catch (error) {
    await warnUnavailable(error);
    return { kind: 'unavailable' };
  }
});

/** Slugs to prerender at build time; none without a database, and each renders on first request. */
export async function vacancySlugs(): Promise<Array<{ slug: string }>> {
  try {
    const repo = await import('@/lib/repositories/vacancies');
    return (await repo.publishedSlugs()).map((slug) => ({ slug }));
  } catch (error) {
    await warnUnavailable(error);
    return [];
  }
}
