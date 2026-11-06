import type { MetadataRoute } from 'next';

/**
 * /robots.txt. The API is JSON for the site's own pages, so crawling it only
 * spends rate limit and counts downloads that never happened.
 *
 * /admin is deliberately not disallowed: its pages say noindex (header and
 * meta tag), and a crawler barred by robots.txt never fetches a page to read
 * that — it can still list the bare URL from a link. Build output (/_next,
 * /vendor) stays crawlable too, because a search engine runs a page's scripts
 * to see what it shows; those responses carry noindex instead.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
  };
}
