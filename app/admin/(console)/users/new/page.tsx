import type { Metadata } from 'next';
import CreateAccount from './create-account';

export const metadata: Metadata = { title: 'New account' };

export default function NewAccountPage() {
  return <CreateAccount />;
}
