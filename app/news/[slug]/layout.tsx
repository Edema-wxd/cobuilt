import type { ReactNode } from 'react';
import { redirectIfGone } from '../../redirect-or-not-found';
import { loadArticle } from './load-article';

/**
 * Sends an old article address on before the page streams its loading state
 * (see `redirectIfGone`). Renders nothing of its own.
 */
export default async function ArticleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await redirectIfGone(`/news/${slug}`, async () => (await loadArticle(slug)).kind === 'not-found');
  return children;
}
