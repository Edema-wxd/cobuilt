import { PRODUCTION_ORIGIN, siteOrigin } from './seo';

/**
 * The rules a redirect's two ends follow (docs/decisions.md §2.27). Pure, so
 * the console's form checks a rule as it is typed with the API's own test,
 * and the lookup reads a requested path exactly as a source was stored.
 *
 * A source is a path on this site, compared without its case, a trailing
 * slash or percent-encoding: `/About-Us/` and `/about-us` are one source. The
 * console and the API are never redirected, nor is Next.js's own `/_next`.
 */

export const MAX_SOURCE_LENGTH = 512;
export const MAX_DESTINATION_LENGTH = 1024;

const RESERVED = /^\/(admin|api|_next)(\/|$)/i;

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** Whitespace, a backslash or a control character: never part of a path anyone means. */
function hasUnsafeCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f || character === '\\' || /\s/.test(character);
  });
}

function decoded(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    // A malformed escape is compared as written rather than refused.
    return path;
  }
}

/** A requested path in the form sources are stored in: `/About-Us/?x=1` → `/about-us`. */
export function lookupKey(path: string): string {
  const bare = decoded(path.split(/[?#]/, 1)[0] ?? '').toLowerCase();
  return bare.replace(/\/+$/, '') || '/';
}

/** Whether a path belongs to the console, the API or Next.js, which no rule may touch. */
export function isReservedPath(path: string): boolean {
  return RESERVED.test(lookupKey(path));
}

/** Validates and normalises a source path as an editor typed it. */
export function checkSource(input: string): Checked<string> {
  const value = input.trim();
  if (!value.startsWith('/') || value.startsWith('//')) {
    return { ok: false, message: 'Must be a path on this site, starting with a single /, such as /old-page' };
  }
  if (/[?#]/.test(value)) {
    return { ok: false, message: 'Give the path only, without a ? query or # fragment' };
  }
  if (hasUnsafeCharacter(value)) {
    return { ok: false, message: 'Must not contain spaces, backslashes or control characters' };
  }
  if (value.length > MAX_SOURCE_LENGTH) {
    return { ok: false, message: `Must be ${MAX_SOURCE_LENGTH} characters or fewer` };
  }
  const key = lookupKey(value);
  if (key === '/') return { ok: false, message: 'The homepage cannot be redirected' };
  if (isReservedPath(key)) {
    return { ok: false, message: 'Paths under /admin, /api and /_next cannot be redirected' };
  }
  return { ok: true, value: key };
}

/** A destination, and the path on this site it lands on (null for another site). */
export interface CheckedDestination {
  destination: string;
  sitePath: string | null;
}

/**
 * Validates a destination: a path on this site (a query string or fragment is
 * kept) or an absolute http(s) URL. A URL on this site's own origin counts as
 * a path on it, so it is caught by the loop check like any other.
 */
export function checkDestination(input: string, origins: readonly string[] = siteOrigins()): Checked<CheckedDestination> {
  const value = input.trim();
  if (!value) return { ok: false, message: 'Give a path on this site or a full web address' };
  if (value.length > MAX_DESTINATION_LENGTH) {
    return { ok: false, message: `Must be ${MAX_DESTINATION_LENGTH} characters or fewer` };
  }
  if (hasUnsafeCharacter(value)) {
    return { ok: false, message: 'Must not contain spaces, backslashes or control characters' };
  }

  if (value.startsWith('/')) {
    if (value.startsWith('//')) {
      return { ok: false, message: 'Start with a single / for this site, or https:// for another' };
    }
    return { ok: true, value: { destination: value, sitePath: lookupKey(value) } };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: 'Give a path on this site, such as /projects, or a full web address' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, message: 'A web address must start with https:// or http://' };
  }
  const sitePath = origins.includes(url.origin) ? lookupKey(url.pathname) : null;
  return { ok: true, value: { destination: value, sitePath } };
}

/** This site's origins: the configured one, and production (a copied production link is still this site). */
export function siteOrigins(): string[] {
  return [...new Set([siteOrigin().origin, PRODUCTION_ORIGIN])];
}
