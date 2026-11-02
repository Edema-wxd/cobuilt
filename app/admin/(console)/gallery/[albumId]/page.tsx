import type { Metadata } from 'next';
import AlbumEditor from '../album-editor';

export const metadata: Metadata = { title: 'Edit album' };

export default async function EditAlbumPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  return <AlbumEditor albumId={albumId} />;
}
