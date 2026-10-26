import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProjectDetail from './project-detail';
import { EMPTY, loadProject } from './load-project';

/**
 * Project detail — `/projects/[slug]`.
 *
 * Built from the handoff mockup "CoBuilt Project Detail" (direction 3c).
 *
 * This page renders on the server. A project page is the canonical, shareable
 * URL for a development: it needs the project's own SEO fields in the document
 * head, an Open Graph image for link previews, and a real 404 for a slug that
 * does not exist — none of which a client-side fetch gives. A checkout with no
 * database still renders: the load is wrapped, and a failure shows the
 * "couldn't be loaded" state rather than a 500. See docs/decisions.md §2.10.
 *
 * The body is a client component — it drives the gallery and the virtual tour
 * viewer — and receives the loaded data as props.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadProject(slug);

  if (result.kind !== 'found' || !result.props.project) {
    // `absolute` because this is already the full title, so the root layout's
    // template must not append the house name a second time.
    return { title: { absolute: 'Project — CoBuilt Investment Partners' } };
  }

  const { project } = result.props;

  const title = project.seo.metaTitle ?? `${project.title} — CoBuilt Investment Partners`;
  const description =
    project.seo.metaDescription ??
    project.description ??
    `${project.title}: a CoBuilt development with its Project Passport™ — a dated, public record from commencement to handover.`;
  const shareImage = project.seo.openGraphImageUrl ?? project.featuredImageUrl;

  return {
    title: { absolute: title },
    description,
    ...(project.seo.canonicalUrl ? { alternates: { canonical: project.seo.canonicalUrl } } : {}),
    openGraph: {
      type: 'article',
      title: project.title,
      description,
      ...(shareImage ? { images: [shareImage] } : {}),
    },
    // Always large: a page without its own image has a generated card
    // (opengraph-image.tsx beside it).
    twitter: { card: 'summary_large_image' },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadProject(slug);

  if (result.kind === 'not-found') notFound();

  // `unavailable` falls through with empty props: the component's own
  // "couldn't be loaded" state is the designed response to a missing database.
  return <ProjectDetail {...(result.kind === 'found' ? result.props : EMPTY)} />;
}
