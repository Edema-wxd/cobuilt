import { z } from 'zod';
import { NEWS_CATEGORIES, normalizeNewsCategory } from '../news-categories';
import { httpUrl, pagination, queryBoolean, slug, uuid } from './common';

/** The five categories the media centre offers (src/lib/news-categories.ts). */
export const newsCategory = z.enum(NEWS_CATEGORIES);

/**
 * A category as sent: a known one in any spelling, or a launch-era name
 * (`update`, `announcement`), arrives as its canonical value; anything else is
 * kept as given, as a CMS category is. Blank clears it.
 */
const categoryField = z
  .string()
  .max(100)
  .transform((value) => normalizeNewsCategory(value));

export const listNewsQuery = pagination.extend({
  // `/news?category=update` links shared before the rename keep working.
  category: categoryField.transform((value) => value ?? undefined).optional(),
  tag: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
  includeUnpublished: queryBoolean.default(false),
});

const newsBase = {
  title: z.string().trim().min(3).max(255),
  slug: slug.optional(),
  content: z.string().min(1).max(200_000),
  excerpt: z.string().max(300).nullish(),
  category: categoryField.nullish(),
  featuredImageUrl: httpUrl.nullish(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  metaTitle: z.string().max(255).nullish(),
  metaDescription: z.string().max(160).nullish(),
  publishedAt: z.string().datetime().nullish(),
  authorId: uuid.nullish(),
};

export const createNewsBody = z.object(newsBase);
export type CreateNewsBody = z.infer<typeof createNewsBody>;

export const updateNewsBody = z
  .object(newsBase)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateNewsBody = z.infer<typeof updateNewsBody>;
