import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '../../../components/og';
import { loadArticle } from './load-article';

/**
 * An article's link preview, for one with no featured image — one that has
 * an image shares that instead (page.tsx).
 */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'An article from the CoBuilt Investment Partners media centre';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  });
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadArticle(slug);
  const article = result.kind === 'found' ? result.props.article : null;

  if (!article) return ogCard({ eyebrow: 'Media centre', title: 'News and insights from CoBuilt' });

  return ogCard({
    eyebrow: ['Media centre', article.category].filter(Boolean).join(' · '),
    title: article.title,
    detail: formatDate(article.publishedAt),
  });
}
