import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '../../../components/og';
import { SERVICES, findService } from '../services';

/** A service page's link preview. Static: the six services are in code. */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'A CoBuilt Investment Partners service';

export function generateStaticParams(): Array<{ slug: string }> {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = findService(slug);

  return ogCard({
    eyebrow: service?.informational ? 'Information only' : 'Our services',
    title: service?.title ?? 'Our services',
  });
}
