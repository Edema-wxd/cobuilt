import { z } from 'zod';
import { httpUrl, isoDate } from './common';

export const milestoneType = z.enum([
  'commencement',
  'foundation',
  'superstructure',
  'roofing',
  'mep',
  'finishes',
  'practical_completion',
  'handover',
  'custom',
]);

export const milestoneStatus = z.enum(['pending', 'in_progress', 'completed', 'delayed']);

const milestoneBase = {
  milestoneType,
  title: z.string().trim().max(255).nullish(),
  description: z.string().max(10_000).nullish(),
  scheduledDate: isoDate.nullish(),
  actualDate: isoDate.nullish(),
  status: milestoneStatus.default('pending'),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  photoUrls: z.array(httpUrl).max(50).optional(),
  documentUrls: z.array(httpUrl).max(50).optional(),
  videoUrl: httpUrl.nullish(),
  isPublic: z.boolean().optional(),
  metaTitle: z.string().max(255).nullish(),
  metaDescription: z.string().max(160).nullish(),
};

/**
 * Mirrors the passport_completed_has_date CHECK constraint so the caller gets
 * a 422 naming the field rather than a 500 from the database.
 */
const completedNeedsActualDate = (
  body: { status?: string; actualDate?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (body.status === 'completed' && !body.actualDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['actualDate'],
      message: 'A completed milestone must record its actual date',
    });
  }
};

export const createMilestoneBody = z.object(milestoneBase).superRefine(completedNeedsActualDate);
export type CreateMilestoneBody = z.infer<typeof createMilestoneBody>;

export const updateMilestoneBody = z
  .object(milestoneBase)
  .partial()
  .superRefine(completedNeedsActualDate)
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateMilestoneBody = z.infer<typeof updateMilestoneBody>;

export const listMilestonesQuery = z.object({
  status: milestoneStatus.optional(),
  includeInternal: z.coerce.boolean().default(false),
});
