import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query, queryOne } from '@/lib/db';
import * as siteSettings from '@/lib/repositories/siteSettings';
import { DEFAULT_HOMEPAGE_SETTINGS } from '@/lib/schemas/settings';
import { loadHomeNews } from '../../app/home-news';
import { loadHomeLeaders } from '../../app/home-leadership';
import { FALLBACK_STATS, loadHomeSettings } from '../../app/home-settings';

/**
 * The landing page's server-side loaders beyond projects (home-projects.test.ts):
 * latest news, the leadership spotlight, and the administrator's settings with
 * the computed figures. Each must show published content only, in order, and
 * fall back rather than fail when its query does.
 */
describeWithDatabase('landing page content', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Runs `check` with `table` renamed away, so every query against it fails. */
  async function withTableMissing(table: string, check: () => Promise<void>): Promise<void> {
    await query(`ALTER TABLE ${table} RENAME TO ${table}_unavailable`);
    try {
      await check();
    } finally {
      await query(`ALTER TABLE ${table}_unavailable RENAME TO ${table}`);
    }
  }

  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  describe('latest news', () => {
    async function article(slug: string, publishedAt: string | null, deleted = false) {
      await query(
        `INSERT INTO news_articles (title, slug, content, excerpt, category, published_at, deleted_at)
         VALUES ($1, $2, 'Body', 'Standfirst', 'update', $3, $4)`,
        [slug.replace(/-/g, ' '), slug, publishedAt, deleted ? new Date().toISOString() : null],
      );
    }

    it('shows the three most recent published articles, newest first', async () => {
      await article('oldest', daysAgo(10));
      await article('older', daysAgo(5));
      await article('newer', daysAgo(2));
      await article('newest', daysAgo(1));
      await article('draft', null);
      await article('scheduled', daysAgo(-1));
      await article('deleted', daysAgo(0.5), true);

      const news = await loadHomeNews();

      expect(news.map((a) => a.slug)).toEqual(['newest', 'newer', 'older']);
      expect(news[0]).toMatchObject({ category: 'update', excerpt: 'Standfirst' });
      expect(news[0]!.published).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
    });

    it('returns no articles, rather than failing, when the query fails', async () => {
      await article('live', daysAgo(1));
      await withTableMissing('news_articles', async () => {
        expect(await loadHomeNews()).toEqual([]);
      });
    });
  });

  describe('leadership spotlight', () => {
    async function leader(slug: string, sortOrder: number, published = true, bio: string | null = null) {
      await query(
        `INSERT INTO leadership (full_name, slug, role_title, bio, sort_order, published)
         VALUES ($1, $2, 'Director', $3, $4, $5)`,
        [slug.replace(/-/g, ' '), slug, bio, sortOrder, published],
      );
    }

    it('shows up to three published profiles in their sort order', async () => {
      await leader('fourth', 4);
      await leader('second', 2);
      await leader('unpublished', 0, false);
      await leader('first', 1);
      await leader('third', 3);

      const leaders = await loadHomeLeaders();

      expect(leaders.map((l) => l.slug)).toEqual(['first', 'second', 'third']);
      expect(leaders[0]).toMatchObject({ name: 'first', role: 'Director', photo: null });
    });

    it('cuts a long biography to a short summary without markup', async () => {
      const sentence = 'Leads the delivery of every CoBuilt scheme from appraisal to handover. ';
      await leader('long-bio', 1, true, `<p>${sentence.repeat(6)}</p>`);

      const [loaded] = await loadHomeLeaders();

      expect(loaded!.summary!.length).toBeLessThanOrEqual(180);
      expect(loaded!.summary).not.toContain('<');
      expect(loaded!.summary!.endsWith('.')).toBe(true);
    });

    it('returns no profiles, rather than failing, when the query fails', async () => {
      await leader('live', 1);
      await withTableMissing('leadership', async () => {
        expect(await loadHomeLeaders()).toEqual([]);
      });
    });
  });

  describe('settings and figures', () => {
    async function project(status: string, location: string | null, publishedAt: string | null) {
      const locationId = location
        ? (await queryOne<{ id: string }>(
            `INSERT INTO locations (name, slug) VALUES ($1, $1)
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [location],
          ))!.id
        : null;
      await query(
        `INSERT INTO projects (title, slug, status, location_id, published_at)
         VALUES ($1, $1, $2, $3, $4)`,
        [`p-${Math.random().toString(36).slice(2, 10)}`, status, locationId, publishedAt],
      );
    }

    it('shows no figures and every section on a fresh database', async () => {
      const settings = await loadHomeSettings();

      expect(settings).toEqual({
        heroHeadline: null,
        heroSubheading: null,
        video: null,
        stats: [],
        showNews: true,
        showLeadership: true,
      });
    });

    it('counts figures from published projects only', async () => {
      await project('completed', 'lekki', daysAgo(3));
      await project('completed', 'ikoyi', daysAgo(2));
      await project('ongoing', 'lekki', daysAgo(1));
      await project('future', 'abuja', daysAgo(1));
      await project('completed', 'yaba', null);

      const { stats } = await loadHomeSettings();

      expect(stats.map((s) => [s.key, s.value, s.plus])).toEqual([
        ['completed', 2, false],
        ['ongoing', 1, false],
        ['locations', 3, false],
      ]);
    });

    it('lets an override replace a count, set units, and hide a figure with 0', async () => {
      await project('completed', 'lekki', daysAgo(1));
      await project('ongoing', 'ikoyi', daysAgo(1));
      await siteSettings.saveHomepageSettings(
        {
          ...DEFAULT_HOMEPAGE_SETTINGS,
          stats: {
            completed: { value: 5, plus: true },
            ongoing: { value: 0, plus: false },
            units: { value: 30, plus: true },
            locations: null,
          },
        },
        null,
      );

      const { stats } = await loadHomeSettings();

      expect(stats).toEqual([
        { key: 'completed', value: 5, plus: true, label: 'Projects delivered' },
        { key: 'units', value: 30, plus: true, label: 'Units developed' },
        { key: 'locations', value: 2, plus: false, label: 'Locations' },
      ]);
    });

    it('carries the hero copy, the video and the section switches', async () => {
      await siteSettings.saveHomepageSettings(
        {
          ...DEFAULT_HOMEPAGE_SETTINGS,
          heroHeadline: 'Built to be *checked*.',
          heroSubheading: 'Every milestone on the record.',
          video: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'One year on site' },
          sections: { news: false, leadership: true, video: true },
        },
        null,
      );

      const settings = await loadHomeSettings();

      expect(settings).toMatchObject({
        heroHeadline: 'Built to be *checked*.',
        heroSubheading: 'Every milestone on the record.',
        video: { id: 'dQw4w9WgXcQ', title: 'One year on site' },
        showNews: false,
        showLeadership: true,
      });
    });

    it('hides the video when its section is switched off', async () => {
      await siteSettings.saveHomepageSettings(
        {
          ...DEFAULT_HOMEPAGE_SETTINGS,
          video: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'One year on site' },
          sections: { news: true, leadership: true, video: false },
        },
        null,
      );

      expect((await loadHomeSettings()).video).toBeNull();
    });

    it('reads a stored field that no longer validates as its default, keeping the rest', async () => {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('homepage', $1)`,
        [
          JSON.stringify({
            heroHeadline: 'Still valid',
            video: { url: 'https://vimeo.com/123', title: 'Not YouTube' },
          }),
        ],
      );

      const settings = await loadHomeSettings();

      expect(settings.heroHeadline).toBe('Still valid');
      expect(settings.video).toBeNull();
      expect(settings.showNews).toBe(true);
    });

    it('falls back to the page as built, with the old figures, when the query fails', async () => {
      await withTableMissing('site_settings', async () => {
        const settings = await loadHomeSettings();
        expect(settings.stats).toEqual(FALLBACK_STATS);
        expect(settings.heroHeadline).toBeNull();
        expect(settings.video).toBeNull();
      });
    });
  });
});
