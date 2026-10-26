import type { Metadata } from 'next';
import NewsEditor from '../news-editor';

export const metadata: Metadata = { title: 'Edit article' };

export default async function EditArticlePage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  return <NewsEditor articleId={articleId} />;
}
