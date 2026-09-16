/**
 * Cookie consent state.
 *
 * Only essential cookies are on by default; nothing in the other three
 * categories may be loaded until `read()` reports it granted. The choice lives
 * in localStorage, which can throw or return nothing (private windows, blocked
 * site data), so every access is guarded and an unreadable store is treated as
 * "not yet answered" rather than as consent.
 */

export const STORAGE_KEY = 'cobuilt.cookie-consent';

/** Bumping this re-asks everyone, which is the correct response to a change
 *  in what the categories cover. */
export const CONSENT_VERSION = 1;

export interface CookieConsent {
  v: number;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  /** ISO timestamp — NDPA expects the time consent was given to be evidenced. */
  at: string;
}

export const OPTIONAL_CATEGORIES = [
  {
    key: 'analytics',
    title: 'Analytics',
    body: 'Anonymous page-view counts, so we can see which projects draw interest.',
  },
  {
    key: 'functional',
    title: 'Functional',
    body: 'Remembers preferences such as a project filter or a dismissed notice.',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    body: 'Measures whether a campaign led you here. Off unless you turn it on.',
  },
] as const;

export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number]['key'];

export const DENY_ALL: Record<OptionalCategory, boolean> = {
  analytics: false,
  functional: false,
  marketing: false,
};

export const ALLOW_ALL: Record<OptionalCategory, boolean> = {
  analytics: true,
  functional: true,
  marketing: true,
};

/** Fired when something asks for the preferences panel — the footer link. */
export const OPEN_PREFERENCES_EVENT = 'cobuilt:cookie-preferences';

function isConsent(value: unknown): value is CookieConsent {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    c.v === CONSENT_VERSION &&
    typeof c.analytics === 'boolean' &&
    typeof c.functional === 'boolean' &&
    typeof c.marketing === 'boolean'
  );
}

/**
 * Returns the stored choice, or null when none has been made — including when
 * storage is unavailable, so the banner is shown rather than silently skipped.
 */
export function read(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isConsent(parsed) ? parsed : null;
  } catch {
    // Unparseable, or an older shape: ask again rather than assume.
    return null;
  }
}

export function write(choice: Record<OptionalCategory, boolean>): CookieConsent {
  const consent: CookieConsent = { v: CONSENT_VERSION, ...choice, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // The choice still governs this page view; it just will not be remembered.
  }
  return consent;
}

export function openPreferences(): void {
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT));
}
