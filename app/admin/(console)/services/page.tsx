import type { Metadata } from 'next';
import ServiceList from './service-list';

export const metadata: Metadata = { title: 'Services' };

export default function ServicesPage() {
  return <ServiceList />;
}
