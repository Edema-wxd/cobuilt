import type { Metadata } from 'next';
import AlbumEditor from '../album-editor';

export const metadata: Metadata = { title: 'New album' };

export default function NewAlbumPage() {
  return <AlbumEditor albumId={null} />;
}
