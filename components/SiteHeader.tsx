import { useEffect, useRef, useState } from 'react';
import { EMAIL, NAV, PHONE, PHONE_HREF } from './site';
import { container } from './ui';

const utilityLink = 'hover:text-orange-on-dark';

/**
 * Below `lg` the nav is a disclosure panel under the header; from `lg` up it
 * sits inline. The panel scrolls inside itself, since nine links outgrow a
 * landscape phone.
 */
const navBase =
  'items-center font-semibold uppercase tracking-[0.11em] text-ink-mid lg:flex lg:gap-3.5 lg:text-[0.625rem] xl:gap-5 xl:text-[0.688rem]';
const navPanel =
  'max-lg:absolute max-lg:inset-x-0 max-lg:top-full max-lg:z-41 max-lg:flex max-lg:max-h-[calc(100dvh-62px)] max-lg:flex-col max-lg:items-stretch max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:border-b max-lg:border-line max-lg:bg-white max-lg:px-gutter max-lg:pt-2 max-lg:pb-5 max-lg:text-[0.75rem] max-lg:shadow-[0_12px_24px_rgb(0_0_0/8%)] sm:max-lg:max-h-[calc(100dvh-78px)]';
const navLink =
  'whitespace-nowrap max-lg:flex max-lg:min-h-target max-lg:items-center max-lg:border-b max-lg:border-line lg:border-b-2 lg:py-1';

interface Props {
  /** href of the nav item to mark current, e.g. "/" or "/careers". */
  current?: string;
}

export default function SiteHeader({ current = '/' }: Props) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // The open menu is a disclosure panel: Escape dismisses it and returns focus
  // to the toggle, and widening past the breakpoint closes it so it cannot be
  // left open behind the inline nav.
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    }

    const wide = window.matchMedia('(min-width: 1081px)');
    function onWiden(): void {
      if (wide.matches) setOpen(false);
    }

    document.addEventListener('keydown', onKey);
    wide.addEventListener('change', onWiden);
    return () => {
      document.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWiden);
    };
  }, [open]);

  return (
    <>
      <div className="bg-ink text-[0.719rem] text-zinc-200">
        <div
          className={`${container} flex min-h-9 flex-wrap items-center justify-between gap-5 py-1.5`}
        >
          <div className="flex flex-wrap gap-3.5 tracking-[0.04em] sm:gap-6">
            <a
              className={`inline-flex min-h-8 items-center sm:inline sm:min-h-0 ${utilityLink}`}
              href={PHONE_HREF}
            >
              {PHONE}
            </a>
            <a
              className={`inline-flex min-h-8 items-center sm:inline sm:min-h-0 ${utilityLink}`}
              href={`mailto:${EMAIL}`}
            >
              {EMAIL}
            </a>
          </div>
          <div className="hidden items-center gap-5 text-[0.656rem] uppercase tracking-[0.1em] sm:flex">
            <a className={utilityLink} href="/#register">
              WhatsApp Business
            </a>
            <a className={utilityLink} href="/#register">
              LinkedIn
            </a>
            <a className={utilityLink} href="/#leadership">
              YouTube
            </a>
            {/*
              `/search` does not exist yet (docs/design-handover.md §3.5). The
              projects index is the only searchable surface that does, so the
              entry point goes there rather than to a landing-page anchor.
            */}
            <a className="text-orange-on-dark" href="/projects">
              Search
            </a>
          </div>
        </div>
      </div>

      {/* Stays pinned at every width, so the menu is always one tap away. */}
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div
          className={`${container} flex min-h-15.5 items-center justify-between gap-6 sm:min-h-19.5`}
        >
          <a href="/" aria-label="CoBuilt Investment Partners — home">
            <img
              className="block h-8 w-auto flex-none sm:h-9.5"
              src="/images/cobuilt-logo-light.webp"
              alt="CoBuilt Investment Partners"
              width={112}
              height={38}
            />
          </a>

          <nav className={open ? `${navBase} ${navPanel}` : `hidden ${navBase}`} aria-label="Main">
            {NAV.map((item) => {
              const isCurrent = item.href === current;
              return (
                <a
                  key={item.label}
                  className={
                    isCurrent
                      ? `${navLink} text-rust lg:border-orange`
                      : `${navLink} hover:text-rust lg:border-transparent`
                  }
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              );
            })}
            {/* Charcoal, not white: white on #FF6600 is 2.94:1. */}
            <a
              className="inline-flex min-h-target items-center justify-center border border-transparent bg-orange px-5 text-[0.688rem] font-semibold uppercase tracking-[0.13em] text-ink transition-colors duration-150 hover:bg-orange-lift max-lg:mt-3"
              href="/#register"
            >
              Discuss your project
            </a>
          </nav>

          <button
            ref={toggleRef}
            className="inline-flex size-target cursor-pointer items-center justify-center border border-zinc-300 bg-transparent lg:hidden"
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span
              className="relative block h-0.5 w-4.5 bg-ink before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:bg-ink after:absolute after:inset-x-0 after:top-1.5 after:h-0.5 after:bg-ink"
              aria-hidden="true"
            />
          </button>
        </div>
      </header>
    </>
  );
}
