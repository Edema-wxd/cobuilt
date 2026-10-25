import type { Metadata } from 'next';
import PageHero from '../components/PageHero';
import SiteLayout from '../components/SiteLayout';
import { btnOrange, btnOutlineOnDark } from '../components/ui';

/**
 * The 404 page, rendered for any unmatched route and for every `notFound()`
 * call — an unknown project, article or service slug.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <SiteLayout>
      <main>
        <PageHero
          eyebrow="Error 404"
          title={
            <>
              We could not find <em>that page</em>.
            </>
          }
          standfirst="The address may have been mistyped, or the page may have moved. Every project and its Passport™ record can be reached from the projects index."
          actions={
            <>
              <a className={btnOrange} href="/projects">
                Explore our projects
              </a>
              <a className={btnOutlineOnDark} href="/">
                Back to home
              </a>
            </>
          }
        />
      </main>
    </SiteLayout>
  );
}
