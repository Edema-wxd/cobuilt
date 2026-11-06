import type { MetadataRoute } from 'next';
import { absoluteUrl, isIndexable } from '@/lib/seo';

/**
 * `/robots.txt` (docs/decisions.md §2.27).
 *
 * Production: the whole public site, except the console, the API and search
 * results. `/search` itself is `noindex`; a results page (`/search?q=…`) is
 * one of endlessly many, so crawlers are kept off them altogether rather than
 * spending the crawl on them. Filtered lists (`/news?category=…`) stay
 * crawlable, because their canonical is the bare list.
 *
 * Anything else — a Vercel preview, a staging copy, a local build — refuses
 * every crawler, and `next.config.mjs` adds `X-Robots-Tag: noindex` to every
 * response there, which also covers a page linked from somewhere a crawler
 * ignores robots.txt. Built once per deployment, from that deployment's
 * environment.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/search?'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
