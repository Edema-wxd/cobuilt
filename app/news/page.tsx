import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';
import NewsIndex from './news-index';

/**
 * News and articles — `/news`, the list beneath the media centre (`/media`).
 *
 * The body is a client component: filters live in the query string and the list
 * is fetched in the browser, so a checkout without a database still renders the
 * page. This file carries the metadata, which only a server component can
 * export.
 */

export const metadata: Metadata = {
  title: 'News and articles',
  description:
    'Press releases, project updates, thought leadership, industry insight and company announcements from CoBuilt Investment Partners, with project progress recorded in each development’s Project Passport™.',
  // Filters live in the query string; every filtered view is this page.
  alternates: canonical('/news'),
};

/**
 * Rendered per request rather than prerendered, for the same reason as the
 * projects index: the body reads the query string through `useSearchParams`,
 * which a static prerender cannot resolve. See app/projects/page.tsx.
 */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <NewsIndex />;
}
