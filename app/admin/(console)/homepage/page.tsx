import type { Metadata } from 'next';
import HomepageSettings from './homepage-settings';

export const metadata: Metadata = { title: 'Homepage' };

export default function HomepagePage() {
  return <HomepageSettings />;
}
