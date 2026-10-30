/**
 * Tailwind class strings for the landing-style pages — the home page and the
 * standalone pages built from its sections (About, Leadership, Services,
 * Passport™, Media, Contact).
 *
 * `components/prose.ts` is the other half of this pair: it dresses the pages
 * that are *read* (legal, Careers), where the measure is narrow and the rhythm
 * comes from the prose. This file dresses the pages that are *scanned*, where
 * the rhythm comes from full-width section bands.
 *
 * These strings were written once on the home page and are shared here rather
 * than copied, so a change to the section rhythm lands on every page at once.
 *
 * Colour rule, enforced by __tests__/unit/contrast.test.ts: orange is a
 * background with charcoal labels, never text on white.
 */

export const section = 'py-13 sm:py-16 md:py-22';
export const sectionLight = `${section} bg-white`;
export const sectionMuted = `${section} border-t border-line bg-zinc-100`;
export const sectionDark = `${section} bg-ink text-white`;
/** Rises in as it scrolls into view; see `reveal` in styles/globals.css. */
export const sectionHead = 'reveal flex flex-col gap-3.5';

export const titleLg = 'text-[length:clamp(1.875rem,3.4vw,2.75rem)]';
export const titleMd = 'text-[length:clamp(1.75rem,3vw,2.5rem)]';
export const titleSm = 'text-[length:clamp(1.5rem,2.4vw,2.125rem)]';

export const glyph = 'text-[1.25rem] leading-none';
export const cardTitle = 'text-[0.781rem] font-semibold uppercase text-ink';
export const cardBody = 'text-[0.906rem] leading-[1.7] text-zinc-600';
export const uppercaseLink =
  'font-semibold uppercase tracking-[0.14em] text-rust hover:text-rust-hover';

/** Body copy inside a section band, light ground and dark. */
export const bodyCopy = 'text-base leading-[1.8] text-zinc-700';
export const bodyCopyOnDark = 'text-base leading-[1.75] text-zinc-200';

/** The 1px gap over a grey ground draws the hairlines between cards. */
export const cardGrid =
  'reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300';
export const card = 'flex flex-col gap-3 bg-white p-6 sm:p-8.5';

/** The regulatory notice, which every investor-facing path has to carry. */
export const notice =
  'border-l-3 border-orange pl-4 text-[0.844rem] leading-[1.7] text-zinc-700';
export const noticeOnDark =
  'border-l-3 border-orange pl-4 text-[0.844rem] leading-[1.7] text-zinc-200';
export const NOTICE_TEXT =
  'This is an information request only. CoBuilt Investment Partners does not currently offer or solicit investment. An Investor Portal will be introduced once all required regulatory approvals and licences are in place.';

export const field = 'flex flex-col gap-1.75';
export const fieldLabel = 'text-[0.688rem] font-semibold uppercase tracking-[0.14em] text-zinc-700';
/** 16px on a phone: below that, iOS Safari zooms the page when a field takes focus. */
export const input =
  'min-h-12 w-full rounded-none border border-zinc-400 bg-white px-3.5 text-base text-ink sm:min-h-11.5 sm:text-[0.875rem]';
