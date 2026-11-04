import { z } from 'zod';
import { isoDate, pagination, slug, uuid } from './common';
import { ALT_TEXT_MAX, CAPTION_MAX, GALLERY_CATEGORIES, GALLERY_UPLOAD } from '../gallery';

/**
 * Image gallery requests: the public list (`/api/gallery`) and the console's
 * albums and images (`/api/admin/gallery`).
 */

export const galleryCategory = z.enum(GALLERY_CATEGORIES);

export const listGalleryQuery = pagination.extend({
  category: galleryCategory.optional(),
  /** A project's slug or id: albums documenting that project. */
  project: z.string().trim().min(1).max(255).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});
export type ListGalleryQuery = z.infer<typeof listGalleryQuery>;

/**
 * Where a linked image may live: an https URL, or a path to a file already on
 * this site (`/images/…`). http is refused because the image is shown inline
 * on an https page, where it would be blocked as mixed content; a
 * protocol-relative `//host` is refused because it is a remote URL in disguise.
 */
export const galleryImageUrl = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .refine((value) => {
    if (value.startsWith('/')) return !value.startsWith('//') && !/\s/.test(value);
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Must be an https:// URL or a path on this site starting with /');

/** Descriptive alt text is required on every image (WCAG 1.1.1). */
export const altText = z
  .string()
  .trim()
  .min(3, 'Describe the image for people who cannot see it')
  .max(ALT_TEXT_MAX);

const caption = z.string().trim().max(CAPTION_MAX).nullable();

/*
 * No `.default()` here: under `.partial()` a default would fill in a field the
 * caller left out, and an update would then overwrite it. Create applies its
 * defaults below.
 */
const albumBase = {
  title: z.string().trim().min(2).max(255),
  slug: slug.optional(),
  description: z.string().trim().max(2000).nullable(),
  category: galleryCategory,
  projectId: uuid.nullable(),
  published: z.boolean(),
};

export const createAlbumBody = z
  .object({
    ...albumBase,
    description: albumBase.description.default(null),
    projectId: albumBase.projectId.default(null),
    // A new album is a draft until someone publishes it.
    published: albumBase.published.default(false),
  })
  .strict();
export type CreateAlbumBody = z.infer<typeof createAlbumBody>;

export const updateAlbumBody = z
  .object({
    ...albumBase,
    /** One of this album's images, shown on its card; null falls back to the first. */
    coverImageId: uuid.nullable(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateAlbumBody = z.infer<typeof updateAlbumBody>;

/** The whole list, in its new order. A partial list is refused rather than guessed at. */
const idList = (noun: string, max: number) =>
  z
    .object({ ids: z.array(uuid).min(1).max(max) })
    .strict()
    .refine((body) => new Set(body.ids).size === body.ids.length, {
      path: ['ids'],
      message: `Each ${noun} may appear only once`,
    });

export const reorderAlbumsBody = idList('album', 500);
export const reorderImagesBody = idList('image', 1000);
export type ReorderBody = z.infer<typeof reorderAlbumsBody>;

/**
 * One image to add: either the key of a file just uploaded to UploadThing
 * (`galleryImage`), or a link. Width and height are what the console read from
 * the file; they are optional because a linked image may not report them.
 */
export const newGalleryImage = z
  .object({
    fileKey: z.string().trim().min(1).max(512).optional(),
    imageUrl: galleryImageUrl.optional(),
    altText,
    caption: caption.optional(),
    width: z.number().int().min(1).max(100_000).optional(),
    height: z.number().int().min(1).max(100_000).optional(),
    takenOn: isoDate.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Boolean(value.fileKey) === Boolean(value.imageUrl)) {
      ctx.addIssue({
        code: 'custom',
        path: ['imageUrl'],
        message: 'Give either an uploaded file key or an image URL, not both',
      });
    }
  });
export type NewGalleryImage = z.infer<typeof newGalleryImage>;

export const addImagesBody = z
  .object({ images: z.array(newGalleryImage).min(1).max(GALLERY_UPLOAD.maxFileCount) })
  .strict();
export type AddImagesBody = z.infer<typeof addImagesBody>;

export const updateImageBody = z
  .object({ altText, caption, takenOn: isoDate.nullable() })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateImageBody = z.infer<typeof updateImageBody>;
