import type { Metadata } from 'next';
import LeaderEditor from '../leader-editor';

export const metadata: Metadata = { title: 'New leadership profile' };

export default function NewLeaderPage() {
  return <LeaderEditor leaderId={null} />;
}
