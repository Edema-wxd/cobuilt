import type { MetadataRoute } from 'next';
import type { SitemapKind, SitemapRow } from '@/lib/repositories/sitemap';
import { absoluteUrl } from '@/lib/seo';
import { SERVICES } from './services/services';

/**
 * `/sitemap.xml` — every public page, with absolute URLs on the same origin as
 * `metadataBase` (docs/decisions.md §2.27).
 *
 * The fixed pages, then everything published in the database: projects and
 * their Passport™ records, articles, services, leadership profiles, films and
 * gallery albums, each with the time it last changed. A section's index takes
 * the newest change in its section. Left out: `/search` (results are
 * `noindex`), `/downloads` (a redirect to `/resources`) and the console.
 *
 * Never fails for want of a database: the query is wrapped, and without it —
 * including at build time — the sitemap lists the fixed pages and the built-in
 * service pages, which render without one, and the next regeneration picks
 * the rest up. Regenerated at most once an hour; crawlers read it far less
 * often than that. No `priority` or `changefreq`: Google ignores both.
 *
 * One sitemap holds 50,000 URLs. The site has hundreds; if it ever approached
 * the limit, `generateSitemaps` splits this into an index of several.
 */

export const revalidate = 3600;

/** Pages that exist whatever the database holds. `section` ties an index to the rows beneath it. */
const STATIC_PAGES: Array<{ path: string; section?: SitemapKind }> = [
  { path: '/' },
  { path: '/about' },
  { path: '/leadership', section: 'leader' },
  { path: '/services', section: 'service' },
  { path: '/projects', section: 'project' },
  { path: '/passport' },
  { path: '/media', section: 'news' },
  { path: '/news', section: 'news' },
  { path: '/videos', section: 'video' },
  { path: '/gallery', section: 'album' },
  { path: '/resources' },
  { path: '/faqs' },
  { path: '/contact' },
  { path: '/careers', section: 'vacancy' },
  { path: '/privacy' },
  { path: '/terms' },
  { path: '/cookies' },
  { path: '/accessibility' },
];

const PATH: Record<SitemapKind, (slug: string) => string> = {
  project: (slug) => `/projects/${slug}`,
  passport: (slug) => `/projects/${slug}/passport`,
  news: (slug) => `/news/${slug}`,
  service: (slug) => `/services/${slug}`,
  leader: (slug) => `/leadership/${slug}`,
  video: (slug) => `/videos/${slug}`,
  album: (slug) => `/gallery/${slug}`,
  vacancy: (slug) => `/careers/${slug}`,
};


async function loadRows(): Promise<SitemapRow[] | null> {
  try {
    const repo = await import('@/lib/repositories/sitemap');
    return await repo.publishedEntries();
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Sitemap content unavailable; listing the fixed pages only', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * A project whose editor set a canonical address elsewhere is that address's
 * page, not this one, so it is left for that address to list.
 */
function listsItself(row: SitemapRow): boolean {
  if (row.kind !== 'project' || !row.canonical_url) return true;
  return row.canonical_url.replace(/\/+$/, '') === absoluteUrl(PATH.project(row.slug));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await loadRows();

  if (!rows) {
    return [
      ...STATIC_PAGES.map(({ path }) => ({ url: absoluteUrl(path) })),
      ...SERVICES.map(({ slug }) => ({ url: absoluteUrl(PATH.service(slug)) })),
    ];
  }

  const latest = new Map<SitemapKind, Date>();
  for (const row of rows) {
    const current = latest.get(row.kind);
    if (!current || row.updated_at > current) latest.set(row.kind, row.updated_at);
  }

  return [
    ...STATIC_PAGES.map(({ path, section }) => {
      const modified = section ? latest.get(section) : undefined;
      return { url: absoluteUrl(path), ...(modified ? { lastModified: modified } : {}) };
    }),
    ...rows.filter(listsItself).map((row) => ({
      url: absoluteUrl(PATH[row.kind](row.slug)),
      lastModified: row.updated_at,
    })),
  ];
}
