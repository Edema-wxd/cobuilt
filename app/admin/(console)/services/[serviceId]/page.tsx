import type { Metadata } from 'next';
import ServiceEditor from '../service-editor';

export const metadata: Metadata = { title: 'Edit service' };

export default async function EditServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  return <ServiceEditor serviceId={serviceId} />;
}
