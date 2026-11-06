/**
 * The site's address as search engines see it: the absolute origin, canonical
 * URLs, whether this deployment may be indexed at all, and the text of a
 * JSON-LD block (docs/decisions.md §2.27).
 *
 * No server imports, so the client components that render a breadcrumb trail
 * (components/PageHero.tsx is used by client pages too) can build absolute
 * URLs with the same rule as the server. `NEXT_PUBLIC_WEBSITE_URL` is read by
 * its literal name so Next.js inlines it into the browser bundle.
 */

/**
 * The production site (docs/deployment.md). Only a deployment whose
 * `NEXT_PUBLIC_WEBSITE_URL` is exactly this may be indexed: a preview, a
 * staging copy or a local `next start` tells crawlers to stay away, so a copy
 * of the site never competes with the real one in search results.
 */
export const PRODUCTION_ORIGIN = 'https://www.cobuiltpartners.com';

/**
 * The absolute origin for canonical, Open Graph, sitemap and structured-data
 * URLs — the root layout's `metadataBase`. An unset or malformed value falls
 * back to the production origin, so an absolute URL is never built against
 * localhost.
 */
export function siteOrigin(value: string | undefined = process.env.NEXT_PUBLIC_WEBSITE_URL): URL {
  try {
    return new URL(new URL(value ?? PRODUCTION_ORIGIN).origin);
  } catch {
    return new URL(PRODUCTION_ORIGIN);
  }
}

/**
 * Whether search engines may index this deployment. Vercel sets `VERCEL_ENV`
 * on every deployment (`production`, `preview` or `development`); anything but
 * `production` is refused. Off Vercel the origin decides, and it has to be set
 * explicitly: the fallback in `siteOrigin` is for building URLs, not a licence
 * to be indexed. `next.config.mjs` repeats this test for its `X-Robots-Tag`
 * header, because a config file cannot import TypeScript.
 */
export function isIndexable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV !== undefined && env.VERCEL_ENV !== 'production') return false;
  const configured = env.NEXT_PUBLIC_WEBSITE_URL;
  if (!configured) return false;
  try {
    return new URL(configured).origin === PRODUCTION_ORIGIN;
  } catch {
    return false;
  }
}

/** `/projects/ocean-ridge` → `https://www.cobuiltpartners.com/projects/ocean-ridge`. An absolute URL is returned as it is. */
export function absoluteUrl(path: string, origin: URL = siteOrigin()): string {
  return new URL(path, origin).toString();
}

/**
 * The canonical form of a page's path: no query string, no fragment, no
 * trailing slash. A filtered list (`/news?category=project_update`,
 * `/videos?category=drone`) is the same page as the bare list, so every
 * filter canonicalises to the path alone.
 */
export function canonicalPath(path: string): string {
  const bare = path.split(/[?#]/, 1)[0] ?? '';
  const trimmed = bare.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed || '/' : `/${trimmed}`;
}

/**
 * A page's `alternates` metadata: `alternates: canonical('/news')`. Absolute,
 * so the tag reads the same whatever `metadataBase` resolves to.
 */
export function canonical(path: string): { canonical: string } {
  return { canonical: absoluteUrl(canonicalPath(path)) };
}

/**
 * The text of a `<script type="application/ld+json">` block.
 *
 * JSON.stringify does not escape `<`, so a headline containing
 * `</script><script>…` would end the block and run as markup. Every `<`, `>`
 * and `&` becomes its `\u` escape — still the same JSON to a parser — and so
 * do U+2028 and U+2029, which end a line in some script parsers.
 */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
