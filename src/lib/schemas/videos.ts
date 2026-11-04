import { z } from 'zod';
import { VIDEO_CATEGORIES } from '../videos';
import { isoDate, pagination, slug, uuid } from './common';
import { httpsUrl } from './leadership';
import { youtubeLink } from './settings';

/**
 * Video library requests: the public list (`/api/videos`) and the console's
 * writes (`/api/admin/videos`).
 *
 * The YouTube link is the homepage's rule (`youtubeLink`): one video on
 * YouTube's own hosts, stored as the canonical watch link, from which the
 * repository keeps only the ID. Anything else — another site, a channel or a
 * playlist — is a 422 naming the field.
 */

export const videoCategory = z.enum(VIDEO_CATEGORIES);

/** A calendar date that exists: the format check alone lets 2026-02-31 through to PostgreSQL. */
const calendarDate = isoDate.refine((value) => {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}, 'Must be a real date');

/*
 * No `.default()` here: under `.partial()` a default would fill in a field the
 * caller left out, and an update would then overwrite it. Create applies its
 * defaults below.
 */
const videoBase = {
  youtubeUrl: youtubeLink,
  title: z.string().trim().min(2).max(255),
  slug: slug.optional(),
  description: z.string().trim().max(5000),
  category: videoCategory,
  /** The development the film documents; null unlinks it. */
  projectId: uuid.nullable(),
  /** A still of the editor's choosing; https only, as it is shown inline on an https page. */
  thumbnailUrl: httpsUrl.nullable(),
  /** Up to a day; a longer film is a typing slip. */
  durationSeconds: z.number().int().min(1).max(86_400).nullable(),
  recordedOn: calendarDate.nullable(),
  featured: z.boolean(),
  published: z.boolean(),
};

export const createVideoBody = z
  .object({
    ...videoBase,
    description: videoBase.description.default(''),
    projectId: videoBase.projectId.default(null),
    thumbnailUrl: videoBase.thumbnailUrl.default(null),
    durationSeconds: videoBase.durationSeconds.default(null),
    recordedOn: videoBase.recordedOn.default(null),
    featured: videoBase.featured.default(false),
    // A new video is a draft until someone publishes it.
    published: videoBase.published.default(false),
  })
  .strict();
export type CreateVideoBody = z.infer<typeof createVideoBody>;

export const updateVideoBody = z
  .object(videoBase)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateVideoBody = z.infer<typeof updateVideoBody>;

/** The whole list, in its new order. A partial list is refused rather than guessed at. */
export const reorderVideosBody = z
  .object({ ids: z.array(uuid).min(1).max(1000) })
  .strict()
  .refine((body) => new Set(body.ids).size === body.ids.length, {
    path: ['ids'],
    message: 'Each video may appear only once',
  });
export type ReorderVideosBody = z.infer<typeof reorderVideosBody>;

/** `GET /api/videos`: published videos, filtered. */
export const listVideosQuery = pagination.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
  category: videoCategory.optional(),
  /** A project's slug: only its films. */
  project: slug.optional(),
  /** Words in the title, the description or the project's name. */
  q: z.string().trim().max(200).optional(),
});
export type ListVideosQuery = z.infer<typeof listVideosQuery>;
