import type { Metadata } from 'next';
import VideoEditor from '../video-editor';

export const metadata: Metadata = { title: 'Edit video' };

export default async function EditVideoPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  return <VideoEditor videoId={videoId} />;
}
