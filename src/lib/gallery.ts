/**
 * Image gallery definitions shared by the API, the public pages and the
 * console. Nothing here reaches a server-only module, so client components
 * import it as well.
 */

/** The spec's six ways of organising the gallery, in the order the page offers them. */
export const GALLERY_CATEGORIES = [
  'completed_projects',
  'ongoing_projects',
  'future_concepts',
  'events',
  'team_activities',
  'corporate_branding',
] as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export const GALLERY_CATEGORY_LABEL: Record<GalleryCategory, string> = {
  completed_projects: 'Completed projects',
  ongoing_projects: 'Ongoing projects',
  future_concepts: 'Future concepts',
  events: 'Events',
  team_activities: 'Team activities',
  corporate_branding: 'Corporate branding',
};

export function isGalleryCategory(value: unknown): value is GalleryCategory {
  return typeof value === 'string' && (GALLERY_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Uploads (`galleryImage` in src/lib/storage/uploadthing.ts). Photographs
 * straight from a camera run 5–12 MB; 16 MB leaves room for them without
 * inviting print masters. Twenty at a time is a day's selection, and keeps one
 * batch's alt text reviewable on one screen.
 */
export const GALLERY_UPLOAD = {
  maxFileBytes: 16 * 1024 * 1024,
  maxFileCount: 20,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  extensions: ['jpg', 'jpeg', 'png', 'webp'],
} as const;

/** Alt text and caption limits, matching the columns. */
export const ALT_TEXT_MAX = 300;
export const CAPTION_MAX = 500;

/**
 * Whether `next/image` may resize this URL: a file on this site, or one stored
 * with UploadThing (`next.config.mjs` `images.remotePatterns`). Any other
 * linked host is shown as it is, because the optimiser refuses a host it was
 * not told about — and fetching arbitrary hosts server-side is not something
 * to switch on for a URL an editor pasted.
 */
export function isOptimisableImage(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === 'utfs.io' || hostname.endsWith('.ufs.sh'));
  } catch {
    return false;
  }
}
