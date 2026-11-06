import type { Metadata } from 'next';
import ApplicationsInbox from './applications-inbox';

export const metadata: Metadata = { title: 'Applications' };

export default function ApplicationsPage() {
  return <ApplicationsInbox />;
}
