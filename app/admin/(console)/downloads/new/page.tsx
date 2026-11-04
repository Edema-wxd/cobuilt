import type { Metadata } from 'next';
import DocumentEditor from '../document-editor';

export const metadata: Metadata = { title: 'Add a document' };

export default function NewDocumentPage() {
  return <DocumentEditor documentId={null} />;
}
