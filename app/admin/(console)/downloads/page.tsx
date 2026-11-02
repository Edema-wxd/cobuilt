import type { Metadata } from 'next';
import DocumentList from './document-list';

export const metadata: Metadata = { title: 'Downloads' };

export default function DownloadsPage() {
  return <DocumentList />;
}
