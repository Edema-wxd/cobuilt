import { z } from 'zod';
import { youtubeVideoId, youtubeWatchUrl } from '../youtube';
import { email, phone } from './common';

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

/*
 * Contact details — the document stored under `site_settings.key = 'contact'`
 * and sent whole to `PUT /api/admin/settings/contact`. The contact page reads
 * it; a key never saved means the details in components/site.ts
 * (src/lib/contactDetails.ts holds that fallback and the link builders).
 */

const contactLine = (max: number) => z.string().trim().min(1).max(max);

export const contactSettingsBody = z.object({
  /** The office address, one line each, as it is printed. */
  addressLines: z.array(contactLine(120)).min(1).max(5),
  phones: z
    .array(z.object({ label: contactLine(60), number: phone }))
    .min(1)
    .max(4),
  emails: z
    .array(z.object({ label: contactLine(60), address: email }))
    .min(1)
    .max(4),
  /** The WhatsApp Business number; null hides the WhatsApp channel. */
  whatsapp: phone.nullable(),
  hours: z
    .array(z.object({ days: contactLine(60), hours: contactLine(60) }))
    .min(1)
    .max(7),
  /**
   * The office's confirmed position, for the click-to-load map. Null hides the
   * map: a pin in the wrong place sends visitors to the wrong building
   * (docs/decisions.md §2.17).
   */
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable(),
});
export type ContactSettings = z.infer<typeof contactSettingsBody>;

/**
 * Reads a stored contact document field by field, as the homepage's is read:
 * a field that no longer validates falls back on its own.
 */
export function readContactSettings(stored: unknown, fallback: ContactSettings): ContactSettings {
  const value = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const shape = contactSettingsBody.shape;
  const field = <K extends keyof ContactSettings>(key: K): ContactSettings[K] => {
    const parsed = shape[key].safeParse(value[key]);
    return parsed.success ? (parsed.data as ContactSettings[K]) : fallback[key];
  };

  return {
    addressLines: field('addressLines'),
    phones: field('phones'),
    emails: field('emails'),
    whatsapp: field('whatsapp'),
    hours: field('hours'),
    location: field('location'),
  };
}
