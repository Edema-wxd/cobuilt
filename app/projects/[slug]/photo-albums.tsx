import { GALLERY_CATEGORY_LABEL, type GalleryCategory } from '@/lib/gallery';
import { container, eyebrow } from '../../../components/ui';
import { FillImage, albumHref, photographCount } from '../../gallery/gallery-shared';

/**
 * "Photo albums" on a project page: the project's published albums in the
 * image gallery, each linking to its page there (docs/decisions.md §2.24).
 * Compact, because the page's own gallery band above already shows the
 * photography; this is the way into the albums, with their captions and the
 * full-screen viewer. Renders nothing when the project has none.
 *
 * Loaded on the server with the rest of the page (`./load-project.ts`).
 */

export interface ProjectAlbum {
  id: string;
  slug: string;
  title: string;
  category: GalleryCategory;
  imageCount: number;
  coverUrl: string | null;
}

export default function PhotoAlbums({ albums, projectSlug }: { albums: ProjectAlbum[]; projectSlug: string }) {
  if (albums.length === 0) return null;

  return (
    <section id="photo-albums" className="border-t border-line bg-white py-10 sm:py-12" aria-labelledby="photo-albums-title">
      <div className={`${container} flex flex-col gap-5`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="flex flex-col gap-2">
            <p className={eyebrow}>Image gallery</p>
            <h2 id="photo-albums-title" className="text-[length:clamp(1.5rem,2.4vw,2.125rem)]">
              Photo albums
            </h2>
          </div>
          {albums.length > 1 ? (
            <a
              className="inline-flex min-h-target items-center text-[0.719rem] font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover"
              href={`/gallery?project=${encodeURIComponent(projectSlug)}`}
            >
              See them in the gallery →
            </a>
          ) : null}
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {albums.map((album) => (
            <li key={album.id}>
              <a
                className="group flex h-full items-center gap-4 border border-line bg-white p-3 transition-colors duration-150 hover:border-ink"
                href={albumHref(album.slug)}
              >
                <span className="relative block aspect-[4/3] w-24 flex-none overflow-hidden bg-line">
                  {/* Decorative: the title beside it names the link. */}
                  {album.coverUrl ? <FillImage src={album.coverUrl} alt="" sizes="96px" /> : null}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[0.969rem] leading-[1.35] text-ink group-hover:text-rust">{album.title}</span>
                  <span className="font-mono text-[0.719rem] uppercase tracking-[0.08em] text-zinc-600">
                    {photographCount(album.imageCount)} · {GALLERY_CATEGORY_LABEL[album.category]}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
