import { cache } from 'react';
import { MILESTONE_LABEL, httpsUrl } from '../project-shared';
import type { PassportRecordProps, RecordEntry } from './passport-record';

/**
 * Server-side data load for `/projects/[slug]/passport`.
 *
 * Lives apart from the page component because both the page and
 * `generateMetadata` need it. `cache` deduplicates the two calls within one
 * request, so a page render is still a single set of queries.
 *
 * Like the project page (docs/decisions.md §2.10) it reads the repositories
 * directly rather than calling the API over HTTP: one round trip, and the
 * response shape is guaranteed by the same serializers the API uses.
 *
 * Everything an editor supplied that this page will put in an `href` is vetted
 * here, on the server, so no unchecked URL reaches the browser at all.
 */

export type LoadResult =
  | { kind: 'found'; props: PassportRecordProps }
  | { kind: 'not-found' }
  /** No database, or it is down: the page renders its "couldn't be loaded" state. */
  | { kind: 'unavailable' };

export const EMPTY: PassportRecordProps = { project: null, entries: [], summary: null };

/**
 * A document's name, read from the last segment of its URL.
 *
 * Exported for `__tests__/unit/passport.test.ts`; the loader is the only
 * caller, and it has already vetted the URL as https, so `new URL` cannot
 * throw here.
 *
 * `document_urls` is a bare text array — there is no title column — so a link
 * reading "https://cdn…/a7f3.pdf" is the alternative. A percent-encoded name
 * decodes; one that will not decode is used as it came.
 */
export function describeDocument(url: string): { url: string; name: string; kind: string | null } {
  const path = new URL(url).pathname;
  const segment = path.slice(path.lastIndexOf('/') + 1);

  let name = segment;
  try {
    name = decodeURIComponent(segment);
  } catch {
    // A lone '%' is not valid encoding; the raw segment is still a name.
  }

  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot + 1).toUpperCase() : '';
  const kind = /^[A-Z0-9]{1,5}$/.test(extension) ? extension : null;

  // Sentence case, because `foundation-completion-certificate.pdf` becomes
  // "foundation completion certificate", which reads as a filename rather than
  // as a document attached to a record. A name that already carries its own
  // capitals keeps them.
  const words = (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, ' ').trim();

  return {
    url,
    name: words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Document',
    kind,
  };
}

export const loadRecord = cache(async (slug: string): Promise<LoadResult> => {
  if (!slug) return { kind: 'not-found' };

  // Imported here rather than at the top of the file: everything below reaches
  // PostgreSQL, and keeping the imports inside this function keeps the module
  // cheap for anything that only needs its types.
  const projectsRepo = await import('@/lib/repositories/projects');
  const passportRepo = await import('@/lib/repositories/passport');
  const { serializeProject, serializeMilestone } = await import('@/lib/serializers');

  try {
    const row = await projectsRepo.findBySlug(slug);
    if (!row) return { kind: 'not-found' };

    const project = serializeProject(row);

    // A project whose Passport is switched off has no record to read, so the
    // milestones are not queried at all — the page renders the closed state
    // from the project alone.
    const milestones = row.passport_enabled
      ? (await passportRepo.listForProject(project.id)).map(serializeMilestone)
      : [];

    const entries: RecordEntry[] = milestones.map((milestone, index) => ({
      id: milestone.id,
      // The record's own numbering: position in the published sequence, which
      // is what a reader cites. `sort_order` is an editor's ordering field and
      // has gaps, so it is not it.
      index: index + 1,
      type: milestone.type,
      typeLabel: MILESTONE_LABEL[milestone.type] ?? 'Milestone',
      // A custom milestone carries its name in `title`; a mandatory one may
      // override the standard label with its own.
      label: milestone.title?.trim() || MILESTONE_LABEL[milestone.type] || 'Milestone',
      description: milestone.description,
      scheduledDate: milestone.scheduledDate,
      actualDate: milestone.actualDate,
      status: milestone.status,
      photoUrls: milestone.photoUrls.filter(Boolean),
      documents: milestone.documentUrls
        .map(httpsUrl)
        .filter((url): url is string => url !== null)
        .map(describeDocument),
      videoUrl: httpsUrl(milestone.videoUrl),
      recordedAt: milestone.triggeredAt,
      // Shown only where it says something the recorded-at does not: that the
      // entry was revised after it was written.
      revisedAt:
        milestone.updatedAt && milestone.triggeredAt && milestone.updatedAt > milestone.triggeredAt
          ? milestone.updatedAt
          : null,
    }));

    const total = entries.length;
    const completed = entries.filter((entry) => entry.status === 'completed').length;
    const delayed = entries.filter((entry) => entry.status === 'delayed').length;
    const next = entries.find((entry) => entry.status !== 'completed') ?? null;

    // The record's last entry is when a milestone was last recorded, which is
    // not the same as the date it happened on — the provenance of the record is
    // the point of showing it.
    const lastEntry = entries.reduce<string | null>((latest, entry) => {
      const recorded = entry.recordedAt;
      return recorded && (!latest || recorded > latest) ? recorded : latest;
    }, null);

    return {
      kind: 'found',
      props: {
        project: {
          id: project.id,
          title: project.title,
          slug: project.slug,
          description: project.description,
          // `PublicProject` widens status to `string`; the row carries the enum.
          status: row.status,
          projectType: project.projectType,
          location: project.location,
          sector: project.sector,
          featuredImageUrl: project.featuredImageUrl,
          passport: project.passport,
        },
        entries,
        summary: row.passport_enabled
          ? {
              total,
              completed,
              delayed,
              percent: total === 0 ? 0 : Math.round((completed / total) * 100),
              lastEntry,
              nextIndex: next?.index ?? null,
            }
          : null,
      },
    };
  } catch {
    // No database, or it is down. The page still renders and says so, rather
    // than returning a 500 — the same posture the project page takes.
    return { kind: 'unavailable' };
  }
});
