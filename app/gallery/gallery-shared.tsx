import Image from 'next/image';
import { isOptimisableImage } from '@/lib/gallery';

/**
 * Pieces shared by `/gallery`, an album page and a project page's albums.
 * Nothing here reaches a server-only module, so client components import it.
 */

/** "1 photograph", "12 photographs". */
export function photographCount(count: number): string {
  return `${count} ${count === 1 ? 'photograph' : 'photographs'}`;
}

/** `/gallery/[slug]`. */
export function albumHref(slug: string): string {
  return `/gallery/${encodeURIComponent(slug)}`;
}

/**
 * A photograph filling its parent, which sets the size: every slot it goes in
 * has a fixed aspect ratio, so nothing moves when the image arrives.
 *
 * `next/image` serves a resized WebP at the width `sizes` asks for, and loads
 * lazily unless `priority` is set. A file it may not resize (a linked image on
 * another host) is shown as stored rather than refused.
 */
export function FillImage({
  src,
  alt,
  sizes,
  priority = false,
  quality = 75,
  fit = 'cover',
  className = '',
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  quality?: 75 | 85;
  fit?: 'cover' | 'contain';
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      quality={quality}
      unoptimized={!isOptimisableImage(src)}
      className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${className}`}
    />
  );
}
