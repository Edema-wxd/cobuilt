import { z } from 'zod';
import { slug, uuid } from './common';

/**
 * Service page requests (`/api/admin/services`).
 *
 * The limits are what the page layout holds comfortably, not database limits:
 * a card line longer than a sentence or two, or a dozen process steps, stops
 * reading as the design intends.
 */

/** One entry in a bulleted list: scope, deliverables, suited to. */
const listItem = z.string().trim().min(1).max(500);
const list = z.array(listItem).max(30);

/** A process step or a benefit: a short title and an optional sentence or two. */
export const serviceStep = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(1000).default(''),
});
export type ServiceStepInput = z.infer<typeof serviceStep>;

/*
 * No `.default()` here: under `.partial()` a default would fill in a field the
 * caller left out, and an update would then overwrite it. Create applies its
 * defaults below.
 */
const serviceBase = {
  title: z.string().trim().min(2).max(255),
  slug: slug.optional(),
  summary: z.string().trim().min(1).max(300),
  standfirst: z.string().trim().max(600),
  body: z.array(z.string().trim().min(1).max(5000)).max(20),
  covers: list,
  deliverables: list,
  suitedTo: list,
  process: z.array(serviceStep).max(12),
  benefits: z.array(serviceStep).max(12),
  informational: z.boolean(),
  published: z.boolean(),
  metaTitle: z.string().trim().max(255).nullable(),
  metaDescription: z.string().trim().max(160).nullable(),
};

export const createServiceBody = z
  .object({
    ...serviceBase,
    standfirst: serviceBase.standfirst.default(''),
    body: serviceBase.body.default([]),
    covers: serviceBase.covers.default([]),
    deliverables: serviceBase.deliverables.default([]),
    suitedTo: serviceBase.suitedTo.default([]),
    process: serviceBase.process.default([]),
    benefits: serviceBase.benefits.default([]),
    informational: serviceBase.informational.default(false),
    // A new service is a draft until someone publishes it.
    published: serviceBase.published.default(false),
    metaTitle: serviceBase.metaTitle.default(null),
    metaDescription: serviceBase.metaDescription.default(null),
  })
  .strict();
export type CreateServiceBody = z.infer<typeof createServiceBody>;

export const updateServiceBody = z
  .object(serviceBase)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateServiceBody = z.infer<typeof updateServiceBody>;

/** The whole list, in its new order. A partial list is refused rather than guessed at. */
export const reorderServicesBody = z
  .object({ ids: z.array(uuid).min(1).max(200) })
  .strict()
  .refine((body) => new Set(body.ids).size === body.ids.length, {
    path: ['ids'],
    message: 'Each service may appear only once',
  });
export type ReorderServicesBody = z.infer<typeof reorderServicesBody>;

/** Replaces the projects shown on a service page; the array order is the page order. */
export const setServiceProjectsBody = z
  .object({
    projects: z
      .array(z.object({ projectId: uuid, caseStudy: z.boolean().default(false) }).strict())
      .max(24),
  })
  .strict()
  .refine((body) => new Set(body.projects.map((p) => p.projectId)).size === body.projects.length, {
    path: ['projects'],
    message: 'Each project may appear only once',
  });
export type SetServiceProjectsBody = z.infer<typeof setServiceProjectsBody>;
