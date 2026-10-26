import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '../../../components/og';
import { loadProject } from './load-project';
import { STATUS_LABEL } from './project-shared';

/**
 * A project's link preview, for a project with no photography of its own —
 * one with a featured or Open Graph image shares that instead (page.tsx).
 */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'A CoBuilt Investment Partners development';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadProject(slug);
  const project = result.kind === 'found' ? result.props.project : null;

  if (!project) return ogCard({ eyebrow: 'Projects', title: 'CoBuilt developments' });

  return ogCard({
    eyebrow: ['Project', project.location].filter(Boolean).join(' · '),
    title: project.title,
    detail: [STATUS_LABEL[project.status], project.passport.enabled ? 'Project Passport™ open' : null]
      .filter(Boolean)
      .join(' · '),
  });
}
