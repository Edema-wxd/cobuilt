import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { bearerFor, callRoute } from '../setup/helpers';
import { pool, queryOne } from '@/lib/db';
import { DEFAULT_HOMEPAGE_SETTINGS, type HomepageSettings } from '@/lib/schemas/settings';
import route from '../../pages/api/admin/settings/homepage';

describeWithDatabase('/api/admin/settings/homepage', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  let admin: { id: string; email: string };

  beforeEach(async () => {
    await truncateAll();
    admin = (await queryOne<{ id: string; email: string }>(
      `INSERT INTO users (email, full_name, role)
       VALUES ('site-admin@test.local', 'Site Admin', 'admin') RETURNING id, email`,
    ))!;
  });

  afterAll(async () => {
    await pool.end();
  });

  const asAdmin = () => ({
    authorization: `Bearer ${bearerFor({ userId: admin.id, email: admin.email, role: 'admin' })}`,
  });

  const settings = (overrides: Partial<HomepageSettings> = {}): HomepageSettings => ({
    ...DEFAULT_HOMEPAGE_SETTINGS,
    ...overrides,
  });

  const put = (body: object) => callRoute(route, { method: 'PUT', headers: asAdmin(), body });

  describe('permissions', () => {
    it('refuses an anonymous caller', async () => {
      expect((await callRoute(route)).status).toBe(401);
      expect((await callRoute(route, { method: 'PUT', body: settings() })).status).toBe(401);
    });

    it.each(['editor', 'viewer', 'investor'] as const)('refuses an %s', async (role) => {
      expect((await callRoute(route, { as: role })).status).toBe(403);
      expect((await callRoute(route, { method: 'PUT', as: role, body: settings() })).status).toBe(403);
    });

    it('lets an admin read the defaults and the computed figures', async () => {
      const { status, body } = await callRoute(route, { headers: asAdmin() });

      expect(status).toBe(200);
      expect(body).toEqual({
        settings: DEFAULT_HOMEPAGE_SETTINGS,
        computed: { completed: 0, ongoing: 0, locations: 0 },
        updatedAt: null,
        updatedBy: null,
      });
    });
  });

  describe('saving', () => {
    it('stores the document, says who saved it, and audits the changed fields', async () => {
      const { status, body } = await put(
        settings({
          heroHeadline: '  Built to be *checked*.  ',
          stats: { ...DEFAULT_HOMEPAGE_SETTINGS.stats, units: { value: 30, plus: true } },
        }),
      );

      expect(status).toBe(200);
      expect(body.settings.heroHeadline).toBe('Built to be *checked*.');
      expect(body.settings.stats.units).toEqual({ value: 30, plus: true });
      expect(body.updatedBy).toBe('Site Admin');
      // No running Next.js server here; the page refreshes on its one-minute schedule.
      expect(body.revalidated).toBe(false);

      const entry = await queryOne<{ action: string; entity_id: string; changes: Record<string, unknown> }>(
        `SELECT action, entity_id, changes FROM audit_log WHERE actor_id = $1`,
        [admin.id],
      );
      expect(entry).toMatchObject({ action: 'settings.updated', entity_id: 'homepage' });
      expect(Object.keys(entry!.changes).sort()).toEqual(['heroHeadline', 'stats']);
    });

    it('writes no audit entry when nothing changed', async () => {
      await put(settings());
      const entries = await queryOne<{ count: string }>(`SELECT count(*)::text AS count FROM audit_log`);
      expect(entries!.count).toBe('0');
    });

    it('treats a cleared text field as "as built"', async () => {
      await put(settings({ heroSubheading: 'Something' }));
      const { body } = await put(settings({ heroSubheading: '' }));
      expect(body.settings.heroSubheading).toBeNull();
    });

    it('requires the whole document', async () => {
      const { status, body } = await put({ heroHeadline: 'Only this' });
      expect(status).toBe(422);
      expect(body.error.details.map((d: { field: string }) => d.field)).toContain('sections');
    });
  });

  describe('the YouTube link', () => {
    it.each([
      ['https://youtu.be/dQw4w9WgXcQ'],
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'],
      ['https://m.youtube.com/shorts/dQw4w9WgXcQ'],
      ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ])('accepts %s and stores the canonical watch link', async (url) => {
      const { status, body } = await put(settings({ video: { url, title: 'One year on site' } }));

      expect(status).toBe(200);
      expect(body.settings.video).toEqual({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'One year on site',
      });
    });

    it.each([
      ['another video host', 'https://vimeo.com/76979871'],
      ['a lookalike host', 'https://youtube.com.example.net/watch?v=dQw4w9WgXcQ'],
      ['a channel rather than a video', 'https://www.youtube.com/@cobuilt'],
      ['a malformed video ID', 'https://www.youtube.com/watch?v=short'],
      ['a script URL', 'javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ'],
      ['not a URL at all', 'dQw4w9WgXcQ'],
    ])('rejects %s', async (_case, url) => {
      const { status, body } = await put(settings({ video: { url, title: 'One year on site' } }));

      expect(status).toBe(422);
      expect(body.error.details[0].field).toBe('video.url');
    });

    it('requires a title for the video', async () => {
      const { status, body } = await put(
        settings({ video: { url: 'https://youtu.be/dQw4w9WgXcQ', title: '' } }),
      );
      expect(status).toBe(422);
      expect(body.error.details[0].field).toBe('video.title');
    });
  });
});
