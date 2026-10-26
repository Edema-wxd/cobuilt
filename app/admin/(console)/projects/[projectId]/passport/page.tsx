import type { Metadata } from 'next';
import MilestoneManager from './milestone-manager';

export const metadata: Metadata = { title: 'Passport milestones' };

export default async function PassportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <MilestoneManager projectId={projectId} />;
}
