import { useEffect, useState } from 'react';
import styles from '../styles/Chrome.module.css';
import {
  ALLOW_ALL,
  DENY_ALL,
  OPEN_PREFERENCES_EVENT,
  OPTIONAL_CATEGORIES,
  type OptionalCategory,
  read,
  write,
} from './cookieConsent';

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
    <aside className={styles.cookie} aria-label="Cookie preferences">
      <div className={`${styles.container} ${styles.cookieInner}`}>
        <p className={styles.cookieText}>
          <strong>Cookies.</strong> Only essential cookies are enabled by default. You may accept
          analytics, functional and marketing cookies, or manage your preferences at any time. See
          our <a href="/cookies">Cookie Policy</a>.
        </p>

        <div className={styles.cookieActions}>
          {managing ? (
            <button
              className={styles.cookieManage}
              type="button"
              onClick={() => save({ ...draft })}
            >
              Save preferences
            </button>
          ) : (
            <button
              className={styles.cookieManage}
              type="button"
              aria-expanded={false}
              onClick={() => setManaging(true)}
            >
              Manage
            </button>
          )}
          <button
            className={styles.cookieEssential}
            type="button"
            onClick={() => save(DENY_ALL)}
          >
            Essential only
          </button>
          <button className={styles.cookieAccept} type="button" onClick={() => save(ALLOW_ALL)}>
            Accept all
          </button>
        </div>

        {managing ? (
          <div className={styles.cookiePanel}>
            <div className={styles.cookieOption}>
              <input
                className={styles.cookieOptionInput}
                id="cookie-essential"
                type="checkbox"
                checked
                disabled
                readOnly
              />
              <label htmlFor="cookie-essential">
                <span className={styles.cookieOptionFixed}>Essential — always on</span>
                <span className={styles.cookieOptionBody}>
                  Security, load balancing and remembering this choice. Cannot be switched off.
                </span>
              </label>
            </div>

            {OPTIONAL_CATEGORIES.map((category) => (
              <div key={category.key} className={styles.cookieOption}>
                <input
                  className={styles.cookieOptionInput}
                  id={`cookie-${category.key}`}
                  type="checkbox"
                  checked={draft[category.key]}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [category.key]: event.target.checked }))
                  }
                />
                <label htmlFor={`cookie-${category.key}`}>
                  <span className={styles.cookieOptionTitle}>{category.title}</span>
                  <span className={styles.cookieOptionBody}>{category.body}</span>
                </label>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
