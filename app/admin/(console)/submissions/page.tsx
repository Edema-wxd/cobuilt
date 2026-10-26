import type { Metadata } from 'next';
import SubmissionsInbox from './submissions-inbox';

export const metadata: Metadata = { title: 'Submissions' };

export default function SubmissionsPage() {
  return <SubmissionsInbox />;
}
