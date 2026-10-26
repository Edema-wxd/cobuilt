import type { Metadata } from 'next';
import InvestorApproval from './investor-approval';

export const metadata: Metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return <InvestorApproval />;
}
