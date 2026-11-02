import type { Metadata } from 'next';
import LeadershipList from './leadership-list';

export const metadata: Metadata = { title: 'Leadership' };

export default function LeadershipPage() {
  return <LeadershipList />;
}
