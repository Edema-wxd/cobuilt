import type { Metadata } from 'next';
import VideoList from './video-list';

export const metadata: Metadata = { title: 'Videos' };

export default function VideosPage() {
  return <VideoList />;
}
