import type { Metadata } from 'next';
import ProjectsIndex from './projects-index';

/**
 * Projects index — `/projects`.
 *
 * The body is a client component: filters live in the query string and the list
 * is fetched in the browser, so a checkout without a database still renders the
 * page. This file carries the metadata, which only a server component can
 * export.
 */

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Completed, under construction and planned developments from CoBuilt Investment Partners, each linked to its Project Passport™ — a dated, public record from commencement to handover.',
};

/**
 * Rendered per request rather than prerendered. The body reads the query string
 * through `useSearchParams`, which a static prerender cannot resolve — Next
 * would otherwise require a Suspense boundary and the prerendered HTML would be
 * the fallback rather than the page. Rendering dynamically means the server
 * sends the full page, with the chrome and the loading state, already reflecting
 * the filters in the URL.
 */
export const dynamic = 'force-dynamic';

export default function Page() {
  return <ProjectsIndex />;
}
