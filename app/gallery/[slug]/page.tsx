import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageHero from '../../../components/PageHero';
import SiteLayout from '../../../components/SiteLayout';
import { btnOutline, container } from '../../../components/ui';
import { GALLERY_CATEGORY_LABEL } from '@/lib/gallery';
import { photographCount } from '../gallery-shared';
import { albumSlugs, loadAlbum } from '../load-gallery';
import AlbumViewer from './album-viewer';

/**
 * Album — `/gallery/[slug]`.
 *
 * One published album: its photographs in the editor's order, each with its
 * alt text and caption, opening in a full-screen viewer (`./album-viewer.tsx`)
 * that works by keyboard, pointer and swipe. Prerendered and regenerated at
 * most once a minute; an album published after the build renders on its first
 * request. A draft, or an album with no images yet, is a 404. With no database
 * the page says it couldn't be loaded rather than answering 404 for an album
 * that may well exist. See docs/decisions.md §2.24.
 */

// Regenerated at most once a minute, like /gallery.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return albumSlugs();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadAlbum(slug);
  if (result.kind !== 'found') return { title: 'Gallery' };

  const { album } = result;
  const description =
    album.description ??
    `${photographCount(album.imageCount)} from CoBuilt Investment Partners — ${GALLERY_CATEGORY_LABEL[album.category].toLowerCase()}.`;

  return {
    title: `${album.title} — Gallery`,
    description,
    openGraph: {
      type: 'website',
      title: `${album.title} — CoBuilt Investment Partners`,
      description,
      // The cover is the album's own photography, which beats the generated card.
      ...(album.cover ? { images: [{ url: album.cover.url, alt: album.cover.alt }] } : {}),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadAlbum(slug);
  if (result.kind === 'not-found') notFound();

  if (result.kind === 'unavailable') {
    return (
      <SiteLayout current="/gallery">
        <main>
          <PageHero
            eyebrow="Image gallery"
            title="Album"
            trail={[{ label: 'Home', href: '/' }, { label: 'Gallery', href: '/gallery' }, { label: 'Album' }]}
          />
          <section className="bg-white py-11 sm:py-14 md:py-18">
            <div className={container}>
              <div className="border border-line bg-zinc-50 px-6 py-10 sm:px-10" role="status">
                <p className="text-[1.0625rem] text-ink">This album couldn’t be loaded.</p>
                <p className="mt-2 text-[0.906rem] leading-[1.7] text-zinc-700">
                  This is on our side. Try again in a minute.
                </p>
              </div>
            </div>
          </section>
        </main>
      </SiteLayout>
    );
  }

  const { album } = result;
  const category = GALLERY_CATEGORY_LABEL[album.category];

  return (
    <SiteLayout current="/gallery">
      <main>
        <PageHero
          eyebrow={category}
          title={album.title}
          {...(album.description ? { standfirst: album.description } : {})}
          trail={[{ label: 'Home', href: '/' }, { label: 'Gallery', href: '/gallery' }, { label: album.title }]}
          meta={
            <>
              {photographCount(album.imageCount)}
              {album.project ? (
                <>
                  {' · '}
                  <a className="text-zinc-200 underline underline-offset-4 hover:text-orange-on-dark" href={`/projects/${album.project.slug}`}>
                    {album.project.title}
                  </a>
                </>
              ) : null}
            </>
          }
        />

        <section className="bg-white py-11 sm:py-14 md:py-18" aria-labelledby="album-photographs">
          <div className={`${container} flex flex-col gap-7`}>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
              <h2 id="album-photographs" className="text-[length:clamp(1.5rem,2.4vw,2.125rem)]">
                Photographs
              </h2>
              <p className="text-[0.844rem] text-zinc-700">
                Select a photograph to see it full size. Arrow keys or a swipe move between them.
              </p>
            </div>

            <AlbumViewer title={album.title} images={album.images} />

            <div className="flex flex-col gap-3 border-t border-line pt-7 sm:flex-row">
              <a className={btnOutline} href="/gallery">
                ← All albums
              </a>
              {album.project ? (
                <a className={btnOutline} href={`/gallery?project=${encodeURIComponent(album.project.slug)}`}>
                  More from {album.project.title}
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
