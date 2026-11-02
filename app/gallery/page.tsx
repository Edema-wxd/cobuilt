import type { Metadata } from 'next';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import { container } from '../../components/ui';
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABEL } from '@/lib/gallery';
import GalleryIndex from './gallery-index';
import { loadGalleryIndex } from './load-gallery';

/**
 * Image gallery — `/gallery`.
 *
 * Albums published from the console (`/admin/gallery`), organised by the
 * spec's six categories and filterable by category and by project. Each card
 * opens the album's own page, where the photographs open in a viewer.
 *
 * The page is prerendered and regenerated at most once a minute, so an album
 * published in the console is live within the minute. The albums are loaded
 * here, on the server, and filtered in the browser (`./gallery-index.tsx`).
 * With no database — as at build time — it renders a "couldn't be loaded"
 * state instead of failing (`./load-gallery.ts`). See docs/decisions.md §2.24.
 */

// Regenerated at most once a minute, like the landing page and /services.
export const revalidate = 60;

const CATEGORY_LIST = GALLERY_CATEGORIES.map((category) =>
  GALLERY_CATEGORY_LABEL[category].toLowerCase(),
);

export const metadata: Metadata = {
  title: 'Gallery',
  description: `Photography from CoBuilt Investment Partners, in albums: ${CATEGORY_LIST.slice(0, -1).join(', ')} and ${CATEGORY_LIST.at(-1)}.`,
};

export default async function Gallery() {
  const data = await loadGalleryIndex();

  return (
    <SiteLayout current="/gallery">
      <main>
        <PageHero
          eyebrow="Image gallery"
          title={
            <>
              The work, <em>as it stands</em>.
            </>
          }
          standfirst="Completed and ongoing developments, future concepts, events, the team and the brand — in albums, with every photograph described."
          trail={[{ label: 'Home', href: '/' }, { label: 'Gallery' }]}
        />

        {data.kind === 'ready' ? (
          <GalleryIndex albums={data.albums} facets={data.facets} />
        ) : (
          <section className="bg-white py-11 sm:py-14 md:py-18">
            <div className={container}>
              <div className="border border-line bg-zinc-50 px-6 py-10 sm:px-10" role="status">
                <p className="text-[1.0625rem] text-ink">The gallery couldn’t be loaded.</p>
                <p className="mt-2 text-[0.906rem] leading-[1.7] text-zinc-700">
                  This is on our side. Try again in a minute, or browse the projects in the meantime.
                </p>
                <a
                  className="mt-4 inline-flex min-h-target items-center text-[0.719rem] font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover"
                  href="/projects"
                >
                  Browse projects →
                </a>
              </div>
            </div>
          </section>
        )}

        <CtaBand
          title="See a development in person"
          body="Photography shows the finish; a visit shows the rest. Tell us which development you would like to see and we will arrange it."
        />
      </main>
    </SiteLayout>
  );
}
