import type { Metadata } from 'next';
import NewsIndex from './news-index';

/**
 * Media centre — `/news`.
 *
 * The body is a client component: filters live in the query string and the list
 * is fetched in the browser, so a checkout without a database still renders the
 * page. This file carries the metadata, which only a server component can
 * export.
 */

export const metadata: Metadata = {
  title: 'Media centre',
  description:
    'Press releases, project updates and announcements from CoBuilt Investment Partners, with project progress recorded in each development’s Project Passport™.',
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
