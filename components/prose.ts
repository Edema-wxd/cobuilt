/**
 * Tailwind class strings for the standalone text pages — legal, accessibility,
 * careers.
 *
 * One measure, one rhythm. These pages are read rather than scanned, so the
 * column is narrower than the landing page's and the vertical spacing is set
 * by the prose itself rather than by section bands.
 */

import { btnOrange } from './ui';

export const head = 'bg-ink pt-13 pb-11 text-white md:pt-18 md:pb-16';
export const headInner = 'mx-auto flex w-full max-w-225 flex-col gap-4.5 px-gutter';
export const title = 'text-[length:clamp(2rem,4.4vw,3rem)] text-white';
export const standfirst = 'max-w-155 text-[1.0625rem] leading-[1.7] text-zinc-200';
export const updated = 'font-mono text-[0.781rem] uppercase tracking-[0.1em] text-zinc-400';

export const body = 'bg-white pt-13 pb-18 md:pt-18 md:pb-24';
export const prose = 'mx-auto flex w-full max-w-190 flex-col gap-8 px-gutter md:gap-10';

/** `group` lets the first section's heading drop its rule. */
export const section = 'group flex flex-col gap-3.5';
export const sectionTitle =
  'border-t border-line pt-7 text-[1.5rem] font-normal tracking-[-0.02em] text-ink group-first:border-t-0 group-first:pt-0';

const links = '[&_a]:text-rust [&_a]:underline [&_a:hover]:text-rust-hover';
export const p = `text-base leading-[1.8] text-zinc-700 ${links}`;
export const list = `flex list-disc flex-col gap-2.5 pl-5.5 text-base leading-[1.75] text-zinc-700 marker:text-rust ${links}`;

/** Retention periods, cookie categories — short two- and three-column facts. */
export const tableWrap = 'overflow-x-auto';
export const table = [
  'w-full min-w-115 border-collapse text-[0.906rem]',
  '[&_th]:border-b [&_th]:border-zinc-300 [&_th]:py-3 [&_th]:pr-4 [&_th]:text-left [&_th]:align-top [&_th]:text-[0.688rem] [&_th]:leading-[1.6] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-zinc-600',
  '[&_td]:border-b [&_td]:border-line [&_td]:py-3 [&_td]:text-left [&_td]:align-top [&_td]:leading-[1.6]',
  '[&_td:first-child]:pr-6 [&_td:first-child]:font-medium [&_td:first-child]:text-ink',
  '[&_td:not(:first-child)]:pr-4 [&_td:not(:first-child)]:text-zinc-700',
].join(' ');

/** Used where the regulatory position has to be impossible to miss. */
export const note = 'flex flex-col gap-2.5 border-l-3 border-orange bg-zinc-100 px-5.5 py-5';
export const noteTitle = 'text-[0.719rem] font-bold uppercase tracking-[0.16em] text-ink';
export const noteBody = 'text-[0.906rem] leading-[1.75] text-zinc-700';

export const action = `${btnOrange} self-start`;
