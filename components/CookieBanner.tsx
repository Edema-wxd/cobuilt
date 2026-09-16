import { useEffect, useState } from 'react';
import {
  ALLOW_ALL,
  DENY_ALL,
  OPEN_PREFERENCES_EVENT,
  OPTIONAL_CATEGORIES,
  type OptionalCategory,
  read,
  write,
} from './cookieConsent';
import { container } from './ui';

const cookieBtn =
  'inline-flex min-h-target flex-1 cursor-pointer items-center justify-center border px-4.5 text-[0.688rem] font-semibold uppercase tracking-[0.14em] sm:flex-none';
const manageBtn = `${cookieBtn} border-zinc-400 bg-white text-ink hover:border-ink`;
const optionInput =
  'peer mt-0.5 size-[17px] flex-none cursor-pointer accent-rust disabled:cursor-not-allowed';
const optionLabel = 'cursor-pointer peer-disabled:cursor-default';
const optionTitle = 'block text-[0.75rem] font-semibold uppercase tracking-[0.08em]';
const optionBody = 'mt-1 block text-[0.75rem] leading-[1.6] text-zinc-600';

/**
 * Cookie banner.
 *
 * "Manage" opens a real per-category panel rather than silently accepting the
 * essential-only default, which is what the brief's banner implies and what
 * the NDPA expects of a consent control. The footer's "Cookie preferences"
 * link reopens this after a choice has been made.
 */
export default function CookieBanner() {
  // `undefined` until storage has been read, so the banner cannot flash for
  // someone who already answered.
  const [answered, setAnswered] = useState<boolean | undefined>(undefined);
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState<Record<OptionalCategory, boolean>>(DENY_ALL);

  useEffect(() => {
    const stored = read();
    setAnswered(stored !== null);
    if (stored) {
      setDraft({
        analytics: stored.analytics,
        functional: stored.functional,
        marketing: stored.marketing,
      });
    }

    function reopen(): void {
      const current = read();
      if (current) {
        setDraft({
          analytics: current.analytics,
          functional: current.functional,
          marketing: current.marketing,
        });
      }
      setManaging(true);
      setAnswered(false);
    }

    window.addEventListener(OPEN_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, reopen);
  }, []);

  function save(choice: Record<OptionalCategory, boolean>): void {
    write(choice);
    setDraft(choice);
    setManaging(false);
    setAnswered(true);
  }

  if (answered !== false) return null;

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto border-t-2 border-orange bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_24px_rgb(0_0_0/10%)]"
      aria-label="Cookie preferences"
    >
      <div
        className={`${container} flex flex-wrap items-center justify-between gap-4 py-5 sm:gap-7`}
      >
        <p className="max-w-155 text-[0.813rem] leading-[1.65] text-zinc-700 [&_a]:text-rust [&_a]:underline [&_strong]:text-ink">
          <strong>Cookies.</strong> Only essential cookies are enabled by default. You may accept
          analytics, functional and marketing cookies, or manage your preferences at any time. See
          our <a href="/cookies">Cookie Policy</a>.
        </p>

        <div className="flex w-full flex-none flex-wrap gap-2.5 sm:w-auto">
          {managing ? (
            <button className={manageBtn} type="button" onClick={() => save({ ...draft })}>
              Save preferences
            </button>
          ) : (
            <button
              className={manageBtn}
              type="button"
              aria-expanded={false}
              onClick={() => setManaging(true)}
            >
              Manage
            </button>
          )}
          <button
            className={`${cookieBtn} border-transparent bg-ink text-white`}
            type="button"
            onClick={() => save(DENY_ALL)}
          >
            Essential only
          </button>
          {/* Charcoal, not white: white on #FF6600 is 2.94:1. */}
          <button
            className={`${cookieBtn} border-transparent bg-orange text-ink hover:bg-orange-lift`}
            type="button"
            onClick={() => save(ALLOW_ALL)}
          >
            Accept all
          </button>
        </div>

        {managing ? (
          <div className="mt-1 grid w-full grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-7 gap-y-4.5 border-t border-line pt-5">
            <div className="flex items-start gap-2.75">
              <input
                className={optionInput}
                id="cookie-essential"
                type="checkbox"
                checked
                disabled
                readOnly
              />
              <label className={optionLabel} htmlFor="cookie-essential">
                <span className={`${optionTitle} text-zinc-600`}>Essential — always on</span>
                <span className={optionBody}>
                  Security, load balancing and remembering this choice. Cannot be switched off.
                </span>
              </label>
            </div>

            {OPTIONAL_CATEGORIES.map((category) => (
              <div key={category.key} className="flex items-start gap-2.75">
                <input
                  className={optionInput}
                  id={`cookie-${category.key}`}
                  type="checkbox"
                  checked={draft[category.key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [category.key]: event.target.checked,
                    }))
                  }
                />
                <label className={optionLabel} htmlFor={`cookie-${category.key}`}>
                  <span className={`${optionTitle} text-ink`}>{category.title}</span>
                  <span className={optionBody}>{category.body}</span>
                </label>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
