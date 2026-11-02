import type { Metadata } from 'next';
import DocumentEditor from '../document-editor';

export const metadata: Metadata = { title: 'Edit document' };

export default async function EditDocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <DocumentEditor documentId={documentId} />;
}
