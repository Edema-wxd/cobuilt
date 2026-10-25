import type { Metadata } from 'next';
import SearchResults from './search-results';

/**
 * Site search — `/search`.
 *
 * A server component only so it can export metadata; the body is client-side
 * for the same reason as the media centre (docs/decisions.md §2.9).
 */
export const metadata: Metadata = {
  title: 'Search',
  description: 'Search CoBuilt Investment Partners’ projects, news and frequently asked questions.',
  robots: { index: false },
};

/** The body reads the query string through `useSearchParams`; see app/projects/page.tsx. */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <SearchResults />;
}
