import type { Metadata } from 'next';
import TourManager from './tour-manager';

export const metadata: Metadata = { title: '3D tours' };

export default function ToursPage() {
  return <TourManager />;
}
