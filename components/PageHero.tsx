import type { ReactNode } from 'react';
import { container, eyebrowOnDark, media } from './ui';

export interface Crumb {
  label: string;
  /** Omitted on the trailing crumb, which is the current page. */
  href?: string;
}

interface Props {
  eyebrow: string;
  /** A node, not a string: headings carry one italic `<em>` accent phrase. */
  title: ReactNode;
  standfirst?: string;
  /**
   * Wayfinding for the pages that sit below the top level — a service, an
   * article. `docs/design-handover.md` §4 lists this as the missing pattern;
   * this is it. The current page is the last crumb and is not a link.
   */
  trail?: Crumb[];
  /** Buttons under the standfirst. */
  actions?: ReactNode;
  /** Photography behind the header, with the scrim the text needs to clear AA. */
  image?: string;
  imageAlt?: string;
  /** Mono metadata on its own rule under the header — a date, a reference. */
  meta?: ReactNode;
}

/**
 * The header band for the landing-style pages.
 *
 * Charcoal, like the home page's hero and the prose pages' head, so arriving on
 * any page in the site looks like arriving on the same site. Over photography
 * the text needs its own ground: the scrim below is the one the home hero uses,
 * which holds 4.5:1 against the lightest frame in the set.
 */
export default function PageHero({
  eyebrow,
  title,
  standfirst,
  trail,
  actions,
  image,
  imageAlt,
  meta,
}: Props) {
  return (
    <section className="relative isolate bg-ink">
      {image ? (
        <>
          <div
            className={`${media} absolute inset-0 -z-2`}
            style={{ backgroundImage: `url('${image}')` }}
            {...(imageAlt ? { role: 'img', 'aria-label': imageAlt } : { 'aria-hidden': true })}
          />
          <div
            className="pointer-events-none absolute inset-0 -z-1 bg-[linear-gradient(180deg,rgb(20_20_20/86%)_0%,rgb(20_20_20/92%)_100%)] sm:bg-[linear-gradient(92deg,rgb(20_20_20/94%)_0%,rgb(20_20_20/82%)_52%,rgb(20_20_20/52%)_100%)]"
            aria-hidden="true"
          />
        </>
      ) : null}

      <div
        className={`${container} flex flex-col gap-4.5 pt-10 pb-11 text-white sm:pt-13 sm:pb-14 md:pt-16 md:pb-18`}
      >
        {trail && trail.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.688rem] uppercase tracking-[0.14em]">
              {trail.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-2">
                  {index > 0 ? (
                    <span className="text-zinc-400" aria-hidden="true">
                      /
                    </span>
                  ) : null}
                  {crumb.href ? (
                    <a
                      className="inline-flex min-h-8 items-center text-zinc-200 hover:text-orange-on-dark sm:min-h-0"
                      href={crumb.href}
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="inline-flex min-h-8 items-center text-zinc-400 sm:min-h-0">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <p className={eyebrowOnDark}>{eyebrow}</p>
        <h1 className="max-w-205 text-[length:clamp(2rem,6vw,3rem)] leading-[1.05] text-white [&_em]:text-orange-on-dark">
          {title}
        </h1>
        {standfirst ? (
          <p className="max-w-155 text-[1.0625rem] leading-[1.7] text-zinc-200">{standfirst}</p>
        ) : null}
        {actions ? (
          <div className="flex flex-col gap-2.5 pt-1.5 sm:flex-row sm:flex-wrap sm:gap-3">
            {actions}
          </div>
        ) : null}
        {meta ? (
          <p className="border-t border-line-on-dark pt-4 font-mono text-[0.781rem] uppercase tracking-[0.1em] text-zinc-400">
            {meta}
          </p>
        ) : null}
      </div>
    </section>
  );
}
