import type { Metadata } from 'next';
import GalleryList from './gallery-list';

export const metadata: Metadata = { title: 'Gallery' };

export default function GalleryPage() {
  return <GalleryList />;
}
