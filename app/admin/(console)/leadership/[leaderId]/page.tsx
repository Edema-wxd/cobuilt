import type { Metadata } from 'next';
import LeaderEditor from '../leader-editor';

export const metadata: Metadata = { title: 'Edit leadership profile' };

export default async function EditLeaderPage({ params }: { params: Promise<{ leaderId: string }> }) {
  const { leaderId } = await params;
  return <LeaderEditor leaderId={leaderId} />;
}
