import type { ReactNode } from 'react';
import { redirectIfGone } from '../../redirect-or-not-found';
import { loadProject } from './load-project';

/**
 * Sends an old project address on before the page streams its loading state
 * (see `redirectIfGone`). Renders nothing of its own.
 *
 * This layout also wraps the project's Passport™ record and cannot tell the
 * two requests apart, so a rule on `/projects/old-name` catches
 * `/projects/old-name/passport` too, and sends it to the same place. A rule on
 * the record's own address applies when the project's address has none.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectIfGone(`/projects/${slug}`, async () => (await loadProject(slug)).kind === 'not-found');
  return children;
}
