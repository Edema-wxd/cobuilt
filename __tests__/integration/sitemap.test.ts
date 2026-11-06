import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query, queryOne } from '@/lib/db';
import sitemap from '../../app/sitemap';

const ORIGIN = 'https://www.cobuiltpartners.com';
const DAY = 86_400_000;

describeWithDatabase('sitemap', () => {
  const saved = process.env.NEXT_PUBLIC_WEBSITE_URL;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_WEBSITE_URL = ORIGIN;
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    else process.env.NEXT_PUBLIC_WEBSITE_URL = saved;
    await pool.end();
  });

  const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

  async function project(
    slug: string,
    options: {
      publishedAt?: string | null;
      passport?: boolean;
      deleted?: boolean;
      canonicalUrl?: string;
      updatedAt?: string;
    } = {},
  ) {
    // updated_at is given on insert: the trigger would overwrite it on an update.
    return (await queryOne<{ id: string }>(
      `INSERT INTO projects (title, slug, status, published_at, passport_enabled, deleted_at, canonical_url, updated_at)
       VALUES ($1, $2, 'ongoing', $3, $4, $5, $6, COALESCE($7::timestamptz, NOW())) RETURNING id`,
      [
        slug,
        slug,
        options.publishedAt === undefined ? ago(1) : options.publishedAt,
        options.passport ?? false,
        options.deleted ? new Date().toISOString() : null,
        options.canonicalUrl ?? null,
        options.updatedAt ?? null,
      ],
    ))!.id;
  }

  /** Every listed URL, as a path, with its last-modified time. */
  async function listed(): Promise<Map<string, Date | undefined>> {
    const entries = await sitemap();
    for (const entry of entries) expect(entry.url.startsWith(`${ORIGIN}/`)).toBe(true);
    return new Map(
      entries.map((entry) => [
        new URL(entry.url).pathname,
        entry.lastModified === undefined ? undefined : new Date(entry.lastModified),
      ]),
    );
  }

  it('lists live content only, each with the time it last changed', async () => {
    await project('live-project', { passport: true });
    await project('draft-project', { publishedAt: null });
    await project('scheduled-project', { publishedAt: new Date(Date.now() + DAY).toISOString() });
    await project('deleted-project', { deleted: true });
    await project('no-passport');

    await query(
      `INSERT INTO news_articles (title, slug, content, published_at) VALUES
         ('Live', 'live-article', 'Body', NOW() - INTERVAL '1 day'),
         ('Draft', 'draft-article', 'Body', NULL)`,
    );
    await query(
      `INSERT INTO services (name, slug, published) VALUES
         ('Project Advisory', 'project-advisory', TRUE),
         ('Development Management', 'development-management', FALSE)`,
    );
    await query(
      `INSERT INTO leadership (full_name, slug, published) VALUES ('Ada', 'ada-obi', TRUE), ('Hidden', 'hidden', FALSE)`,
    );
    await query(
      `INSERT INTO videos (youtube_id, title, slug, category, published) VALUES
         ('abcdefghijk', 'Live film', 'live-film', 'drone', TRUE),
         ('bcdefghijkl', 'Draft film', 'draft-film', 'drone', FALSE)`,
    );
    const albums = await query<{ id: string; slug: string }>(
      `INSERT INTO gallery_albums (title, slug, category, published) VALUES
         ('With photos', 'with-photos', 'events', TRUE),
         ('Empty', 'empty-album', 'events', TRUE),
         ('Draft', 'draft-album', 'events', FALSE)
       RETURNING id, slug`,
    );
    for (const album of albums.rows.filter((row) => row.slug !== 'empty-album')) {
      await query(`INSERT INTO gallery_images (album_id, image_url, alt_text) VALUES ($1, '/x.webp', 'A photograph')`, [album.id]);
    }

    const paths = [...(await listed()).keys()];

    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/projects',
        '/projects/live-project',
        '/projects/live-project/passport',
        '/projects/no-passport',
        '/news/live-article',
        '/services/project-advisory',
        '/leadership/ada-obi',
        '/videos/live-film',
        '/gallery/with-photos',
      ]),
    );
    for (const hidden of [
      '/projects/draft-project',
      '/projects/scheduled-project',
      '/projects/deleted-project',
      '/projects/no-passport/passport',
      '/news/draft-article',
      '/services/development-management',
      '/leadership/hidden',
      '/videos/draft-film',
      '/gallery/empty-album',
      '/gallery/draft-album',
      '/search',
    ]) {
      expect(paths).not.toContain(hidden);
    }
  });

  it("dates a record by its newest public entry, and a section's index by its newest item", async () => {
    const id = await project('ridge', { passport: true, updatedAt: ago(10) });
    await query(
      `INSERT INTO passport_milestones (project_id, milestone_type, status, actual_date, sort_order, is_public, updated_at)
       VALUES ($1, 'foundation', 'completed', CURRENT_DATE - 3, 1, TRUE, $2),
              ($1, 'roofing', 'pending', NULL, 2, FALSE, NOW())`,
      [id, ago(3)],
    );

    const dates = await listed();
    const record = dates.get('/projects/ridge/passport')!;
    const page = dates.get('/projects/ridge')!;

    // The internal entry's later edit is not a change to the public record.
    expect(Math.round((Date.now() - record.getTime()) / DAY)).toBe(3);
    expect(Math.round((Date.now() - page.getTime()) / DAY)).toBe(10);
    expect(dates.get('/projects')).toEqual(page);
    // A page with nothing behind it in the database carries no date.
    expect(dates.get('/about')).toBeUndefined();
  });

  it('leaves a project to the canonical address its editor set elsewhere', async () => {
    await project('syndicated', { canonicalUrl: 'https://partner.example.com/ridge' });
    await project('self-canonical', { canonicalUrl: `${ORIGIN}/projects/self-canonical` });

    const paths = [...(await listed()).keys()];
    expect(paths).not.toContain('/projects/syndicated');
    expect(paths).toContain('/projects/self-canonical');
  });

  it('falls back to the fixed pages when the query fails', async () => {
    await project('live-project');
    await query('ALTER TABLE projects RENAME TO projects_unavailable');
    try {
      const paths = [...(await listed()).keys()];
      expect(paths).toContain('/projects');
      expect(paths).toContain('/services/project-advisory');
      expect(paths).not.toContain('/projects/live-project');
    } finally {
      await query('ALTER TABLE projects_unavailable RENAME TO projects');
    }
  });
});
