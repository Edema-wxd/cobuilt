import { cache } from 'react';
import type { Project, ProjectDetailProps } from './project-detail';

/**
 * Server-side data load for `/projects/[slug]`.
 *
 * Lives apart from the page component because both the page and
 * `generateMetadata` need it. `cache` deduplicates the two calls within one
 * request, so a page render is still a single set of queries.
 *
 * It reads the repositories directly rather than calling the API over HTTP, so
 * there is one round trip and the response shape is guaranteed by the same
 * serializers the API uses.
 */

export type LoadResult =
  | { kind: 'found'; props: ProjectDetailProps }
  | { kind: 'not-found' }
  /** No database, or it is down: the page renders its "couldn't be loaded" state. */
  | { kind: 'unavailable' };

const MILESTONE_LABEL: Record<string, string> = {
  commencement: 'Commencement',
  foundation: 'Foundation',
  superstructure: 'Superstructure',
  roofing: 'Roofing',
  mep: 'MEP',
  finishes: 'Finishes',
  practical_completion: 'Practical completion',
  handover: 'Handover',
  custom: 'Milestone',
};

/**
 * An editor-supplied tour URL, returned only if it is one this page can frame.
 * A `javascript:` or `data:` URL in an iframe `src` executes in this page's
 * context, which is the same hole `embed_code` is withheld to avoid.
 */
function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const EMPTY: ProjectDetailProps = {
  project: null,
  services: [],
  tags: [],
  images: [],
  tours: [],
  passport: null,
  related: [],
};

export const loadProject = cache(async (slug: string): Promise<LoadResult> => {
  if (!slug) return { kind: 'not-found' };

  // Imported here rather than at the top of the file: everything below reaches
  // PostgreSQL, and keeping the imports inside this function keeps the module
  // cheap for anything that only needs its types.
  const projectsRepo = await import('@/lib/repositories/projects');
  const toursRepo = await import('@/lib/repositories/tours');
  const passportRepo = await import('@/lib/repositories/passport');
  const { serializeProject, serializeTour, toDateOnly } = await import('@/lib/serializers');

  try {
    const row = await projectsRepo.findBySlug(slug);
    if (!row) return { kind: 'not-found' };

    const project = serializeProject(row);

    const [services, tags, albums, tourRows, milestones, nearby] = await Promise.all([
      projectsRepo.labelsByIds('services', project.serviceIds),
      projectsRepo.labelsByIds('tags', project.tagIds),
      projectsRepo.galleryForProject(project.id, project.galleryIds),
      toursRepo.listForProject(project.id),
      row.passport_enabled ? passportRepo.listForProject(project.id) : Promise.resolve([]),
      projectsRepo.listProjects({
        // "More in Lagos" is the index filtered by this project's location, so
        // no related-projects field is needed. One extra row is requested to
        // cover this project being among them.
        ...(row.location_id ? { location: row.location_id } : {}),
        page: 1,
        pageSize: 4,
        sort: 'recent',
      }),
    ]);

    const total = milestones.length;
    const completed = milestones.filter((milestone) => milestone.status === 'completed').length;
    const next = milestones.find((milestone) => milestone.status !== 'completed') ?? null;

    // The record's last entry is when a milestone was last recorded, which is
    // not the same as the date it happened on — the provenance of the record is
    // the point of showing it.
    const lastEntry = milestones.reduce<string | null>((latest, milestone) => {
      const recorded = milestone.triggered_at ? new Date(milestone.triggered_at).toISOString() : null;
      return recorded && (!latest || recorded > latest) ? recorded : latest;
    }, null);

    return {
      kind: 'found',
      props: {
        project: project as Project,
        services,
        tags,
        // Albums are a CMS grouping; the page shows one run of photography.
        images: albums.flatMap((album) => album.imageUrls).filter(Boolean),
        tours: tourRows
          .filter((tour) => tour.processing_status === 'ready')
          .map(serializeTour)
          .map(({ id, name, type, description, thumbnailUrl, tourUrl, fileSizeBytes, featured }) => ({
            id,
            name,
            type,
            description,
            thumbnailUrl,
            // A model's `tourUrl` is the .glb file itself, not a page, so it is
            // never an embed; anything else must be https before it is framed.
            embedUrl: type === 'threejs_model' ? null : httpsUrl(tourUrl),
            fileSizeBytes,
            featured,
          })),
        passport: row.passport_enabled
          ? {
              total,
              completed,
              percent: total === 0 ? 0 : Math.round((completed / total) * 100),
              lastEntry,
              next: next
                ? {
                    label: next.title ?? MILESTONE_LABEL[next.milestone_type] ?? 'Milestone',
                    status: next.status,
                    // Same reason `toDateOnly` reads local parts: a DATE column
                    // is local midnight, and toISOString() would move it a day.
                    scheduledDate: toDateOnly(next.scheduled_date),
                  }
                : null,
            }
          : null,
        related: nearby.results
          .filter((item) => item.id !== project.id)
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.title,
            slug: item.slug,
            status: item.status,
            location: item.location_name ?? null,
            featuredImageUrl: item.featured_image_url,
          })),
      },
    };
  } catch {
    // No database, or it is down. The page still renders and says so, rather
    // than returning a 500 — the same posture the projects index takes.
    //
    // Under the pages router this also set a 503 status. An App Router page
    // cannot set its own status code, so the shell now returns 200 with the
    // "couldn't be loaded" state in it. The visible behaviour is unchanged;
    // only the status differs.
    return { kind: 'unavailable' };
  }
});
