import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '../../../../components/og';
import { loadRecord } from './load-record';

/**
 * A Passport's link preview, for a project with no featured image. Says how
 * far the record has got, because that is what a shared Passport is about.
 */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'A CoBuilt Project Passport™ — the public record of a development';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadRecord(slug);
  const { project, summary } = result.kind === 'found' ? result.props : { project: null, summary: null };

  if (!project) return ogCard({ eyebrow: 'Project Passport™', title: 'The public record of a development' });

  return ogCard({
    eyebrow: ['Project Passport™', project.location].filter(Boolean).join(' · '),
    title: project.title,
    detail: !summary
      ? 'Passport not yet opened'
      : summary.total === 0
        ? 'Record opened · no milestones yet'
        : `${summary.completed} of ${summary.total} milestones met · ${summary.percent}% complete`,
  });
}
