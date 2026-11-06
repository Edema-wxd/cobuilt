import type { Metadata } from 'next';
import RedirectManager from './redirect-manager';

export const metadata: Metadata = { title: 'Redirects' };

export default function RedirectsPage() {
  return <RedirectManager />;
}
