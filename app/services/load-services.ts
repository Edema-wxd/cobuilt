import { cache } from 'react';
import type { ServiceProject, ServiceStep } from '@/lib/repositories/services';
import { SERVICES, findService, type Service } from './services';

/**
 * Server-side data for `/services` and `/services/[slug]`.
 *
 * Services are managed in the console and read from PostgreSQL. The static
 * copy in `./services.ts` is the fallback: when the database cannot be reached
 * — including during a build with none configured — the pages render the six
 * original disciplines rather than failing, and the next revalidation picks up
 * the database. The same posture as `app/home-projects.ts`.
 *
 * Reads the repository directly rather than `/api/services` over HTTP, so the
 * pages see exactly what the API returns, in one round trip.
 */

export type { ServiceProject, ServiceStep };

/** A service with everything its page shows. */
export interface ServiceContent extends Service {
  process: ServiceStep[];
  benefits: ServiceStep[];
  metaTitle: string | null;
  metaDescription: string | null;
}

/** The services index card and the "other disciplines" grid. */
export type ServiceCard = Pick<Service, 'slug' | 'title' | 'summary' | 'informational'>;

export interface ServicePageData {
  service: ServiceContent;
  caseStudies: ServiceProject[];
  relatedProjects: ServiceProject[];
  /** Every other published service, in display order. */
  others: ServiceCard[];
}

function toCard({ slug, title, summary, informational }: ServiceCard): ServiceCard {
  return { slug, title, summary, informational };
}

async function warnUnavailable(error: unknown): Promise<void> {
  const { logger } = await import('@/lib/logger');
  logger.warn('Services unavailable; showing the built-in copy', {
    error: error instanceof Error ? error.message : String(error),
  });
}

/** Published services in display order, for the index. */
export const loadServiceCards = cache(async (): Promise<ServiceCard[]> => {
  try {
    const repo = await import('@/lib/repositories/services');
    return (await repo.listPublished()).map(toCard);
  } catch (error) {
    await warnUnavailable(error);
    return SERVICES.map(toCard);
  }
});

/**
 * A published service's page, or null for a slug with no published service.
 * `cache` lets the page, its metadata and its share image share one load.
 */
export const loadServicePage = cache(async (slug: string): Promise<ServicePageData | null> => {
  try {
    const repo = await import('@/lib/repositories/services');
    const service = await repo.findPublishedBySlug(slug);
    if (!service) return null;

    const [projects, cards] = await Promise.all([
      repo.publishedProjectsFor(service.id),
      repo.listPublished(),
    ]);

    return {
      service: {
        slug: service.slug,
        title: service.title,
        summary: service.summary,
        standfirst: service.standfirst,
        body: service.body,
        covers: service.covers,
        deliverables: service.deliverables,
        suitedTo: service.suitedTo,
        informational: service.informational,
        process: service.process,
        benefits: service.benefits,
        metaTitle: service.seo.metaTitle,
        metaDescription: service.seo.metaDescription,
      },
      ...projects,
      others: cards.filter((card) => card.slug !== service.slug).map(toCard),
    };
  } catch (error) {
    await warnUnavailable(error);
    const service = findService(slug);
    if (!service) return null;
    return {
      service: { ...service, process: [], benefits: [], metaTitle: null, metaDescription: null },
      caseStudies: [],
      relatedProjects: [],
      others: SERVICES.filter((item) => item.slug !== slug).map(toCard),
    };
  }
});

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** "Six disciplines": page copy that counts the services follows the console. */
export function disciplineCount(count: number): string {
  return `${NUMBER_WORDS[count] ?? count} ${count === 1 ? 'discipline' : 'disciplines'}`;
}

/** "A, B and C". */
export function listText(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** Slugs to prerender at build time: the database's, or the built-in six without one. */
export async function serviceSlugs(): Promise<Array<{ slug: string }>> {
  return (await loadServiceCards()).map(({ slug }) => ({ slug }));
}
