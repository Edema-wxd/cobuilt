import type { ReactNode } from 'react';
import { redirectIfGone } from '../../../redirect-or-not-found';
import { loadRecord } from './load-record';

/**
 * Sends an old Passport™ record address on before the page streams its
 * loading state (see `redirectIfGone`). Renders nothing of its own.
 */
export default async function PassportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectIfGone(`/projects/${slug}/passport`, async () => (await loadRecord(slug)).kind === 'not-found');
  return children;
}
