import type { Metadata } from 'next';
import NewsList from './news-list';

export const metadata: Metadata = { title: 'News' };

export default function NewsPage() {
  return <NewsList />;
}
