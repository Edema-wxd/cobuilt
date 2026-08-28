import { z } from 'zod';
import { httpUrl, isoDate, pagination, slug, uuid } from './common';

export const projectStatus = z.enum(['future', 'ongoing', 'completed']);

export const listProjectsQuery = pagination.extend({
  status: projectStatus.optional(),
  type: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  sector: z.string().max(100).optional(),
  tag: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['recent', 'title', 'oldest']).default('recent'),
  // Admin-only; ignored for anonymous callers by the route.
  includeUnpublished: z.coerce.boolean().default(false),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>;

const projectBase = {
  title: z.string().trim().min(3).max(255),
  slug: slug.optional(),
  description: z.string().max(2000).nullish(),
  longDescription: z.string().max(50_000).nullish(),
  projectTypeId: uuid.nullish(),
  locationId: uuid.nullish(),
  sectorId: uuid.nullish(),
  status: projectStatus,
  featuredImageUrl: httpUrl.nullish(),
  galleryIds: z.array(uuid).max(100).optional(),
  serviceIds: z.array(uuid).max(50).optional(),
  tagIds: z.array(uuid).max(50).optional(),
  passportEnabled: z.boolean().optional(),
  passportStartDate: isoDate.nullish(),
  passportCompletionTarget: isoDate.nullish(),
  investmentAmount: z.number().nonnegative().max(9_999_999_999_999).nullish(),
  expectedRoi: z.number().min(-999.99).max(999.99).nullish(),
  investorHighlights: z.record(z.string(), z.unknown()).nullish(),
  metaTitle: z.string().max(255).nullish(),
  metaDescription: z.string().max(160).nullish(),
  openGraphImageUrl: httpUrl.nullish(),
  canonicalUrl: httpUrl.nullish(),
  publishedAt: z.string().datetime().nullish(),
};

export const createProjectBody = z.object(projectBase);
export type CreateProjectBody = z.infer<typeof createProjectBody>;

/**
 * Updates are partial, but an empty body is rejected: a PUT that changes
 * nothing is a client bug worth surfacing rather than a silent 200.
 */
export const updateProjectBody = z
  .object(projectBase)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateProjectBody = z.infer<typeof updateProjectBody>;

export const approveInvestorContentBody = z.object({
  approved: z.boolean(),
  note: z.string().max(1000).optional(),
});

export const projectFacetsQuery = z.object({
  type: z.enum(['project', 'news']).default('project'),
});
