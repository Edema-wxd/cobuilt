import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query, queryOne } from '@/lib/db';
import * as news from '@/lib/repositories/news';
import { serializeNews } from '@/lib/serializers';
import { loadMediaCentre } from '../../app/media/load-media';

/**
 * The media centre (`/media`) and the category rename behind it
 * (docs/decisions.md §2.22).
 */
describeWithDatabase('media centre', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

  /** Inserted directly, as the CMS or a pre-0018 database would hold it. */
  async function article(
    slug: string,
    category: string | null,
    publishedAt: string | null,
    options: { deleted?: boolean } = {},
  ) {
    return (await queryOne<{ id: string }>(
      `INSERT INTO news_articles (title, slug, content, category, published_at, deleted_at)
       VALUES ($1, $2, 'Body', $3, $4, $5) RETURNING id`,
      [slug.replace(/-/g, ' '), slug, category, publishedAt, options.deleted ? new Date() : null],
    ))!.id;
  }

  describe('loadMediaCentre', () => {
    it('shows published articles only', async () => {
      await article('live', 'press_release', minutesAgo(5));
      await article('draft', 'press_release', null);
      await article('scheduled', 'press_release', new Date(Date.now() + 86_400_000).toISOString());
      await article('deleted', 'press_release', minutesAgo(1), { deleted: true });

      const groups = await loadMediaCentre();

      expect(groups).toHaveLength(1);
      expect(groups[0]!.articles.map((a) => a.slug)).toEqual(['live']);
    });

    it('groups by category in the spec’s order, newest first, three at most', async () => {
      await article('announce', 'company_announcement', minutesAgo(1));
      await article('insight', 'industry_insight', minutesAgo(2));
      for (const [index, age] of [40, 10, 30, 20].entries()) {
        await article(`press-${index}`, 'press_release', minutesAgo(age));
      }

      const groups = await loadMediaCentre();

      expect(groups.map((g) => g.category)).toEqual([
        'press_release',
        'industry_insight',
        'company_announcement',
      ]);
      expect(groups[0]!.articles.map((a) => a.slug)).toEqual(['press-1', 'press-3', 'press-2']);
      expect(groups[0]!.articles[0]).toMatchObject({
        title: 'press 1',
        category: 'press_release',
        published: expect.stringMatching(/^\d{2} [A-Z][a-z]{2} \d{4}$/),
        image: null,
      });
    });

    it('files launch-era rows under the categories they became', async () => {
      await article('old-update', 'update', minutesAgo(30));
      await article('new-update', 'project_update', minutesAgo(10));
      await article('old-announcement', 'announcement', minutesAgo(20));

      const groups = await loadMediaCentre();

      expect(groups.map((g) => [g.category, g.articles.map((a) => a.slug)])).toEqual([
        ['project_update', ['new-update', 'old-update']],
        ['company_announcement', ['old-announcement']],
      ]);
      expect(groups[0]!.articles[1]!.category).toBe('project_update');
    });

    it('keeps the newest three when two spellings share a category', async () => {
      for (let index = 0; index < 3; index += 1) {
        await article(`legacy-${index}`, 'update', minutesAgo(10 + index * 2));
        await article(`current-${index}`, 'project_update', minutesAgo(11 + index * 2));
      }

      const [group] = await loadMediaCentre();

      expect(group!.articles.map((a) => a.slug)).toEqual(['legacy-0', 'current-0', 'legacy-1']);
    });

    it('puts uncategorised and CMS-only categories last, as one group', async () => {
      await article('none', null, minutesAgo(1));
      await article('events', 'Events', minutesAgo(2));
      await article('press', 'press_release', minutesAgo(3));

      const groups = await loadMediaCentre();

      expect(groups.map((g) => g.category)).toEqual(['press_release', null]);
      expect(groups[1]!.articles.map((a) => [a.slug, a.category])).toEqual([
        ['none', null],
        ['events', 'Events'],
      ]);
    });

    it('returns nothing, rather than failing, when the query fails', async () => {
      await article('live', 'press_release', minutesAgo(1));
      await query('ALTER TABLE news_articles RENAME TO news_articles_unavailable');
      try {
        expect(await loadMediaCentre()).toEqual([]);
      } finally {
        await query('ALTER TABLE news_articles_unavailable RENAME TO news_articles');
      }
    });
  });

  describe('category rename', () => {
    it('filters by a category under either of its names', async () => {
      await article('old', 'update', minutesAgo(2));
      await article('new', 'project_update', minutesAgo(1));
      await article('other', 'press_release', minutesAgo(3));

      for (const category of ['project_update', 'update']) {
        const page = await news.list({ category, page: 1, pageSize: 10 });
        expect(page.results.map((row) => row.slug)).toEqual(['new', 'old']);
      }
    });

    it('serves a launch-era row under its new name', async () => {
      await article('old', 'announcement', minutesAgo(1));
      const row = await news.findBySlug('old');
      expect(serializeNews(row!).category).toBe('company_announcement');
    });

    it('stores the new name whatever a writer sends', async () => {
      const created = await news.create({ title: 'Roof on', content: 'Body', category: 'update' }, null);
      expect(created.category).toBe('project_update');

      const updated = await news.update(created.id, { category: 'Announcement' });
      expect(updated!.category).toBe('company_announcement');
    });

    it('migration 0018 renames stored rows without marking them updated', async () => {
      const id = await article('old', 'update', minutesAgo(60));
      await article('kept', 'Events', minutesAgo(60));
      // Backdated around the trigger, which would otherwise stamp NOW().
      await pool.query(`
        ALTER TABLE news_articles DISABLE TRIGGER trg_news_updated_at;
        UPDATE news_articles SET updated_at = '2026-01-01T00:00:00Z';
        ALTER TABLE news_articles ENABLE TRIGGER trg_news_updated_at;
      `);

      const sql = await readFile(
        join(process.cwd(), 'db', 'migrations', '0018_media_categories.sql'),
        'utf8',
      );
      // Several statements, so the simple protocol: no parameters.
      await pool.query(sql);

      const { rows } = await query<{ id: string; category: string; updated_at: Date }>(
        'SELECT id, category, updated_at FROM news_articles ORDER BY slug',
      );
      expect(rows.map((row) => row.category)).toEqual(['Events', 'project_update']);
      expect(rows.find((row) => row.id === id)!.updated_at.toISOString()).toBe(
        '2026-01-01T00:00:00.000Z',
      );

      // The trigger is back on afterwards: an edit still stamps the row.
      await news.update(id, { title: 'Edited' });
      const edited = await queryOne<{ updated_at: Date }>(
        'SELECT updated_at FROM news_articles WHERE id = $1',
        [id],
      );
      expect(edited!.updated_at.toISOString()).not.toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
