import type { Metadata } from 'next';
import ServiceEditor from '../service-editor';

export const metadata: Metadata = { title: 'New service' };

export default function NewServicePage() {
  return <ServiceEditor serviceId={null} />;
}
