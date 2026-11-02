import { z } from 'zod';
import { youtubeVideoId, youtubeWatchUrl } from '../youtube';

/**
 * Homepage settings — the document stored under `site_settings.key =
 * 'homepage'` and sent whole to `PUT /api/admin/settings/homepage`.
 *
 * Every text field is nullable, and null means "as built": the copy written
 * into app/home-page.tsx. The tagline is deliberately not here — "Building
 * Trust Through Every Brick" is fixed copy (docs/design-handover.md §1).
 */

export const STAT_KEYS = ['completed', 'ongoing', 'units', 'locations'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** A figure an administrator sets in place of the computed one. 0 hides the figure. */
const statOverride = z
  .object({
    value: z.number().int().min(0).max(1_000_000),
    /** Shown as "30+": the figure is a floor, not an exact count. */
    plus: z.boolean().default(false),
  })
  .nullable();

/** Stored as the canonical watch link, whatever form of YouTube link was pasted. */
export const youtubeLink = z
  .string()
  .trim()
  .max(512)
  .transform((value, ctx) => {
    const id = youtubeVideoId(value);
    if (!id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a link to one YouTube video, such as https://www.youtube.com/watch?v=…',
      });
      return z.NEVER;
    }
    return youtubeWatchUrl(id);
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    // A cleared field arrives as "" from a form; store it as "as built".
    .transform((value) => (value ? value : null));

export const homepageSettingsBody = z.object({
  /** `*phrase*` marks the one phrase set in the accent italic. */
  heroHeadline: optionalText(160),
  heroSubheading: optionalText(320),
  video: z
    .object({
      url: youtubeLink,
      /** The frame's accessible name and the caption under the poster. */
      title: z.string().trim().min(3).max(120),
    })
    .nullable(),
  stats: z.object({
    completed: statOverride,
    ongoing: statOverride,
    units: statOverride,
    locations: statOverride,
  }),
  sections: z.object({
    news: z.boolean(),
    leadership: z.boolean(),
    video: z.boolean(),
  }),
});
export type HomepageSettings = z.infer<typeof homepageSettingsBody>;

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  heroHeadline: null,
  heroSubheading: null,
  video: null,
  stats: { completed: null, ongoing: null, units: null, locations: null },
  sections: { news: true, leadership: true, video: true },
};

/**
 * Reads a stored document field by field, so one field that no longer
 * validates (a rule tightened since it was saved) falls back on its own
 * rather than discarding the whole document.
 */
export function readHomepageSettings(stored: unknown): HomepageSettings {
  const value = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const shape = homepageSettingsBody.shape;
  const field = <K extends keyof HomepageSettings>(key: K): HomepageSettings[K] => {
    const parsed = shape[key].safeParse(value[key]);
    return parsed.success ? (parsed.data as HomepageSettings[K]) : DEFAULT_HOMEPAGE_SETTINGS[key];
  };

  return {
    heroHeadline: field('heroHeadline'),
    heroSubheading: field('heroSubheading'),
    video: field('video'),
    stats: field('stats'),
    sections: field('sections'),
  };
}
