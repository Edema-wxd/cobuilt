import type { Metadata } from 'next';
import NewsEditor from '../news-editor';

export const metadata: Metadata = { title: 'New article' };

export default function NewArticlePage() {
  return <NewsEditor articleId={null} />;
}
