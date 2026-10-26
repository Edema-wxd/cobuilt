import type { Metadata } from 'next';
import InvestorApproval from './investor-approval';

export const metadata: Metadata = { title: 'Investor approval' };

export default function InvestorApprovalPage() {
  return <InvestorApproval />;
}
