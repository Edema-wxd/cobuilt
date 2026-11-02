import { z } from 'zod';
import { queryBoolean, slug, uuid } from './common';

/** Request schemas for the leadership profiles (public list and admin CRUD). */

export const LEADERSHIP_TIERS = ['board', 'executive', 'management'] as const;
export const leadershipTier = z.enum(LEADERSHIP_TIERS);

/**
 * https only, unlike the project and news image fields: a portrait is shown
 * inline on an https page, where an http image is blocked as mixed content.
 */
export const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(512)
  .refine((value) => value.startsWith('https://'), 'Must be an https:// URL');

/** A list entry — a qualification or an area of expertise. */
const listEntry = z.string().trim().min(1).max(200);

/** The same entry may not appear twice; order is the editor's. */
const entryList = z
  .array(listEntry)
  .max(20)
  .refine((items) => new Set(items).size === items.length, 'Entries must be unique');

/**
 * Social profiles, by network. Only the networks the page knows how to label
 * are accepted, so the column cannot become free-form storage.
 */
export const socialLinks = z
  .object({ linkedin: httpsUrl, x: httpsUrl, website: httpsUrl })
  .partial()
  .strict();

export const listLeadershipQuery = z.object({
  /** Only the leaders chosen for the homepage spotlight. */
  featured: queryBoolean.optional(),
});

const leaderBase = {
  fullName: z.string().trim().min(2).max(255),
  slug: slug.optional(),
  roleTitle: z.string().trim().min(2).max(255),
  summary: z.string().trim().max(300).nullish(),
  bio: z.string().trim().max(20_000).nullish(),
  qualifications: entryList.optional(),
  expertise: entryList.optional(),
  quote: z.string().trim().max(300).nullish(),
  photoUrl: httpsUrl.nullish(),
  photoAlt: z.string().trim().max(255).nullish(),
  socialLinks: socialLinks.optional(),
  tier: leadershipTier.optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
};

export const createLeaderBody = z.object(leaderBase).strict();
export type CreateLeaderBody = z.infer<typeof createLeaderBody>;

/** Every field optional; null clears an optional one. A slug can change, not clear. */
export const updateLeaderBody = z
  .object(leaderBase)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateLeaderBody = z.infer<typeof updateLeaderBody>;

/** The complete list of leaders in their new order. */
export const reorderLeadershipBody = z.object({
  ids: z
    .array(uuid)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, 'Each leader may appear only once'),
});
export type ReorderLeadershipBody = z.infer<typeof reorderLeadershipBody>;
