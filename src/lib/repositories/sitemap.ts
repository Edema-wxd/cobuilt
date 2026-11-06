import { query } from '../db';

/**
 * What `/sitemap.xml` lists from the database (docs/decisions.md §2.27): every
 * page a visitor can open, with the time it last changed.
 *
 * One round trip for every content type. Each branch applies the same rule as
 * the public page it stands for, so the sitemap never lists a URL that would
 * answer 404: a project or article that is live (published, not in the future,
 * not deleted), a published service, leader or video, and a published album
 * with at least one photograph. A Passport™ record is listed only while the
 * project's Passport is open; one that is not is a `noindex` page. A record
 * changes when a public entry is written or revised, and an album when a
 * photograph is, not only when the project or album row is.
 */

export type SitemapKind = 'project' | 'passport' | 'news' | 'service' | 'leader' | 'video' | 'album';

export interface SitemapRow {
  kind: SitemapKind;
  slug: string;
  updated_at: Date;
  /** A project's own canonical address, when an editor set one. */
  canonical_url: string | null;
}

const LIVE_PROJECT = 'p.deleted_at IS NULL AND p.published_at IS NOT NULL AND p.published_at <= NOW()';

export async function publishedEntries(): Promise<SitemapRow[]> {
  const { rows } = await query<SitemapRow>(
    `SELECT 'project' AS kind, p.slug, p.updated_at, p.canonical_url
       FROM projects p WHERE ${LIVE_PROJECT}
     UNION ALL
     SELECT 'passport', p.slug,
            GREATEST(p.updated_at, (SELECT max(m.updated_at) FROM passport_milestones m
                                     WHERE m.project_id = p.id AND m.is_public)),
            NULL
       FROM projects p WHERE ${LIVE_PROJECT} AND p.passport_enabled
     UNION ALL
     SELECT 'news', n.slug, n.updated_at, NULL
       FROM news_articles n
      WHERE n.deleted_at IS NULL AND n.published_at IS NOT NULL AND n.published_at <= NOW()
     UNION ALL
     SELECT 'service', s.slug, s.updated_at, NULL FROM services s WHERE s.published
     UNION ALL
     SELECT 'leader', l.slug, l.updated_at, NULL FROM leadership l WHERE l.published
     UNION ALL
     SELECT 'video', v.slug, v.updated_at, NULL FROM videos v WHERE v.published
     UNION ALL
     SELECT 'album', a.slug,
            GREATEST(a.updated_at, (SELECT max(i.updated_at) FROM gallery_images i WHERE i.album_id = a.id)),
            NULL
       FROM gallery_albums a
      WHERE a.published AND EXISTS (SELECT 1 FROM gallery_images i WHERE i.album_id = a.id)
     ORDER BY 1, 2`,
  );
  return rows;
}
