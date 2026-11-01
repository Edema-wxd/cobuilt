import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '../../../components/og';
import { loadServicePage, serviceSlugs } from '../load-services';

/**
 * A service page's link preview, from the same load as the page: the
 * console's title, or the built-in copy without a database.
 */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'A CoBuilt Investment Partners service';
export const revalidate = 60;

export function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return serviceSlugs();
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = (await loadServicePage(slug))?.service;

  return ogCard({
    eyebrow: service?.informational ? 'Information only' : 'Our services',
    title: service?.title ?? 'Our services',
  });
}
