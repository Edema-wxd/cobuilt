import { z } from 'zod';
import { httpUrl, pagination, slug, uuid } from './common';

export const newsCategory = z.enum(['press_release', 'update', 'announcement']);

export const listNewsQuery = pagination.extend({
  category: z.string().max(100).optional(),
  tag: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
  includeUnpublished: z.coerce.boolean().default(false),
});

const newsBase = {
  title: z.string().trim().min(3).max(255),
  slug: slug.optional(),
  content: z.string().min(1).max(200_000),
  excerpt: z.string().max(300).nullish(),
  category: z.string().max(100).nullish(),
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
