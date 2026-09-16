/**
 * Tailwind class strings shared across pages.
 *
 * Only the primitives that repeat between files live here; anything used once
 * is written inline where it is used. Each string sets a property once, with
 * no base-and-override pairs, because Tailwind orders utilities by its own
 * rules rather than by their order in `className`.
 *
 * Colour rule, enforced by __tests__/unit/contrast.test.ts: orange is a
 * background with charcoal labels, never text on white.
 */

export const container = 'mx-auto w-full max-w-measure px-gutter';

const eyebrowBase = 'text-[0.719rem] font-medium uppercase tracking-[0.28em]';
export const eyebrow = `${eyebrowBase} text-rust`;
export const eyebrowOnDark = `${eyebrowBase} text-orange-on-dark`;

const btn =
  'inline-flex min-h-12 cursor-pointer items-center justify-center border px-7 text-center text-[0.719rem] font-semibold uppercase tracking-[0.16em] transition-colors duration-150';
export const btnOrange = `${btn} border-transparent bg-orange text-ink hover:bg-orange-lift`;
export const btnWhite = `${btn} border-transparent bg-white text-ink hover:bg-zinc-200`;
export const btnOutlineOnDark = `${btn} border-white text-white hover:bg-white hover:text-ink`;
export const btnOutline = `${btn} border-zinc-300 bg-white text-ink hover:border-ink`;

/** Every photographic block; the image URL is set inline per instance. */
export const media = 'bg-line bg-cover bg-center bg-no-repeat';
