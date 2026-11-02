import type { Metadata } from 'next';
import VideoEditor from '../video-editor';

export const metadata: Metadata = { title: 'Add a video' };

export default function NewVideoPage() {
  return <VideoEditor videoId={null} />;
}
