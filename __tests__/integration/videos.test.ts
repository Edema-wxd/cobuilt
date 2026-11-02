import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import * as videos from '@/lib/repositories/videos';
import { createVideoBody } from '@/lib/schemas/videos';
import publicList from '../../pages/api/videos/index';
import publicDetail from '../../pages/api/videos/[slug]';
import adminList from '../../pages/api/admin/videos/index';
import adminItem from '../../pages/api/admin/videos/[videoId]';
import adminReorder from '../../pages/api/admin/videos/reorder';
import { loadLatest, loadLibrary, loadVideoPage } from '../../app/videos/load-videos';
import { loadProject } from '../../app/projects/[slug]/load-project';

/** The account the test bearer tokens carry (setup/helpers.ts), so audit rows can reference it. */
const ACTOR_ID = '00000000-0000-4000-8000-000000000001';

/** Eleven characters in YouTube's alphabet, distinct per call. */
let sequence = 0;
function youtubeId(): string {
  sequence += 1;
  return `vid${String(sequence).padStart(8, '0')}`;
}

describeWithDatabase('video library', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await truncateAll();
    await query(
      `INSERT INTO users (id, email, full_name, role) VALUES ($1, 'editor@cobuilt.test', 'Test Editor', 'editor')`,
      [ACTOR_ID],
    );
  });

  const input = (overrides: Record<string, unknown> = {}) =>
    createVideoBody.parse({
      youtubeUrl: `https://youtu.be/${youtubeId()}`,
      title: 'Ocean Ridge: one year on site',
      category: 'project_documentary',
      ...overrides,
    });

  async function project(
    slug: string,
    publishedAt: string | null = new Date().toISOString(),
    image: string | null = null,
  ) {
    return (await queryOne<{ id: string }>(
      `INSERT INTO projects (title, slug, status, published_at, featured_image_url)
       VALUES ($1, $2, 'ongoing', $3, $4) RETURNING id`,
      [slug.replace(/-/g, ' '), slug, publishedAt, image],
    ))!.id;
  }

  describe('repository', () => {
    it('stores only the video ID, as a draft at the end of the list with a slug from the title', async () => {
      const first = await videos.create(input({ youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk&t=42' }));
      const second = await videos.create(input({ title: 'Drone pass over Kingsway', category: 'drone' }));

      expect(first).toMatchObject({
        youtubeId: 'abcdefghijk',
        watchUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        slug: 'ocean-ridge-one-year-on-site',
        published: false,
        featured: false,
        project: null,
      });
      expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
      const stored = await queryOne<{ youtube_id: string }>(`SELECT youtube_id FROM videos WHERE id = $1`, [first.id]);
      expect(stored!.youtube_id).toBe('abcdefghijk');
    });

    it('refuses the same film twice and a malformed ID at the database', async () => {
      await videos.create(input({ youtubeUrl: 'https://youtu.be/abcdefghijk' }));
      await expect(
        videos.create(input({ title: 'Again', youtubeUrl: 'https://www.youtube.com/shorts/abcdefghijk' })),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        query(`INSERT INTO videos (youtube_id, title, slug, category) VALUES ('bad id!', 'x', 'x', 'drone')`),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('keeps drafts off every public read', async () => {
      await videos.create(input({ title: 'Draft film' }));
      await videos.create(input({ title: 'Live film', published: true }));

      expect((await videos.listAllPublished()).map((v) => v.slug)).toEqual(['live-film']);
      expect(await videos.findPublishedBySlug('draft-film')).toBeNull();
      expect((await videos.listPublished({ page: 1, pageSize: 24 })).pagination.total).toBe(1);
    });

    it('filters by category, by live project and by words in the title, description or project', async () => {
      const ridge = await project('ocean-ridge');
      const draft = await project('northgate', null);
      await videos.create(input({ title: 'Ridge documentary', projectId: ridge, published: true }));
      await videos.create(
        input({ title: 'Ridge from the air', category: 'drone', projectId: ridge, published: true }),
      );
      await videos.create(
        input({ title: 'Northgate plans', category: 'corporate', projectId: draft, published: true }),
      );
      await videos.create(
        input({ title: 'Passport explained', category: 'educational', description: 'What 100% complete_means', published: true }),
      );

      const slugs = async (filters: videos.VideoFilters) =>
        (await videos.listPublished({ ...filters, page: 1, pageSize: 24 })).results.map((v) => v.slug);

      expect(await slugs({ category: 'drone' })).toEqual(['ridge-from-the-air']);
      expect(await slugs({ project: 'ocean-ridge' })).toEqual(['ridge-documentary', 'ridge-from-the-air']);
      // A draft project is neither linked nor filterable.
      expect(await slugs({ project: 'northgate' })).toEqual([]);
      expect(await slugs({ q: 'AIR' })).toEqual(['ridge-from-the-air']);
      // The project's name is searched, but only where the site links it.
      expect(await slugs({ q: 'ocean ridge' })).toEqual(['ridge-documentary', 'ridge-from-the-air']);
      expect(await slugs({ q: 'northgate plans' })).toEqual(['northgate-plans']);
      expect(await slugs({ q: 'north gate' })).toEqual([]);
      // `%` and `_` are matched as typed, not as wildcards.
      expect(await slugs({ q: '100% complete_' })).toEqual(['passport-explained']);
      expect(await slugs({ q: '_' })).toEqual(['passport-explained']);
      expect(await slugs({ category: 'drone', q: 'documentary' })).toEqual([]);
    });

    it('links a project only while it is live, and falls back to its photograph for the still', async () => {
      const live = await project('ocean-ridge', new Date().toISOString(), 'https://img.cobuilt.test/ridge.jpg');
      const draft = await project('northgate', null, 'https://img.cobuilt.test/northgate.jpg');

      const linked = await videos.create(input({ title: 'Linked', projectId: live, published: true }));
      await videos.create(input({ title: 'Unlinked', projectId: draft, published: true }));
      await videos.create(
        input({ title: 'Own still', projectId: live, thumbnailUrl: 'https://img.cobuilt.test/still.jpg', published: true }),
      );

      expect(await videos.findPublishedBySlug('linked')).toMatchObject({
        thumbnailUrl: 'https://img.cobuilt.test/ridge.jpg',
        project: { id: live, slug: 'ocean-ridge', featuredImageUrl: 'https://img.cobuilt.test/ridge.jpg' },
      });
      expect(await videos.findPublishedBySlug('unlinked')).toMatchObject({ thumbnailUrl: null, project: null });
      expect((await videos.findPublishedBySlug('own-still'))!.thumbnailUrl).toBe('https://img.cobuilt.test/still.jpg');

      // The console still sees the draft project, flagged.
      const admin = await videos.listAll();
      expect(admin.find((v) => v.slug === 'unlinked')!.project).toMatchObject({ slug: 'northgate', isPublished: false });
      expect(admin.find((v) => v.slug === 'linked')!.thumbnailUrl).toBeNull();

      // Deleting the project keeps the film, unlinked.
      await query(`DELETE FROM projects WHERE id = $1`, [live]);
      expect((await videos.findById(linked.id))!.projectId).toBeNull();
    });

    it('relates the same project first, then the same category, published only', async () => {
      const ridge = await project('ocean-ridge');
      const current = await videos.create(input({ title: 'Current', projectId: ridge, published: true }));
      await videos.create(input({ title: 'Same category', published: true }));
      await videos.create(input({ title: 'Same project', category: 'drone', projectId: ridge, published: true }));
      await videos.create(input({ title: 'Unrelated', category: 'corporate', published: true }));
      await videos.create(input({ title: 'Draft sibling', projectId: ridge }));

      const self = (await videos.findPublishedBySlug(current.slug))!;
      expect((await videos.relatedTo(self)).map((v) => v.slug)).toEqual(['same-project', 'same-category']);
    });

    it('lists the latest of a category by recording date', async () => {
      await videos.create(input({ title: 'Older', category: 'leadership_interview', recordedOn: '2025-03-01', published: true }));
      await videos.create(input({ title: 'Undated', category: 'leadership_interview', published: true }));
      await videos.create(input({ title: 'Newer', category: 'leadership_interview', recordedOn: '2026-07-31', published: true }));
      await videos.create(input({ title: 'Other', category: 'corporate', recordedOn: '2026-09-01', published: true }));

      const latest = await videos.latestInCategory('leadership_interview', 2);
      expect(latest.map((v) => v.slug)).toEqual(['newer', 'older']);
      // A DATE comes back as its own calendar day, not shifted by a timezone.
      expect(latest[0]!.recordedOn).toBe('2026-07-31');
    });

    it('reorders only when given every video exactly once', async () => {
      const a = await videos.create(input({ title: 'Alpha' }));
      const b = await videos.create(input({ title: 'Beta' }));
      const c = await videos.create(input({ title: 'Gamma' }));

      expect(await videos.reorder([c.id, a.id])).toBe(false);
      expect(await videos.reorder([c.id, a.id, b.id])).toBe(true);
      expect((await videos.listAll()).map((v) => v.title)).toEqual(['Gamma', 'Alpha', 'Beta']);
    });
  });

  describe('admin API', () => {
    it('requires videos:write: anonymous 401, viewer and investor 403, editor 200', async () => {
      expect((await callRoute(adminList)).status).toBe(401);
      expect((await callRoute(adminList, { as: 'viewer' })).status).toBe(403);
      expect((await callRoute(adminList, { as: 'investor' })).status).toBe(403);

      const res = await callRoute(adminList, { as: 'editor' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ results: [] });

      const asViewer = await callRoute(adminList, {
        method: 'POST',
        as: 'viewer',
        body: { youtubeUrl: 'https://youtu.be/abcdefghijk', title: 'Nope', category: 'drone' },
      });
      expect(asViewer.status).toBe(403);
    });

    it('refuses a link that is not one YouTube video', async () => {
      for (const youtubeUrl of [
        'https://vimeo.com/123456789',
        'https://www.youtube.com/playlist?list=PL0123456789',
        'https://www.youtube.com/@cobuilt',
        'https://youtube.com.evil.test/watch?v=abcdefghijk',
        'javascript:alert(1)//youtu.be/abcdefghijk',
        '<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>',
      ]) {
        const res = await callRoute(adminList, {
          method: 'POST',
          as: 'editor',
          body: { youtubeUrl, title: 'Not a video', category: 'drone' },
        });
        expect(res.status).toBe(422);
        expect(res.body.error.details[0].field).toBe('youtubeUrl');
      }
      expect(await videos.listAll()).toEqual([]);
    });

    it('validates the other fields', async () => {
      const ok = { youtubeUrl: 'https://youtu.be/abcdefghijk', title: 'Valid title', category: 'drone' };

      const missing = await callRoute(adminList, { method: 'POST', as: 'editor', body: { title: 'X' } });
      expect(missing.status).toBe(422);
      expect(missing.body.error.details.map((d: { field: string }) => d.field)).toEqual(
        expect.arrayContaining(['youtubeUrl', 'title', 'category']),
      );

      for (const [field, value] of [
        ['category', 'cat_videos'],
        ['thumbnailUrl', 'http://img.cobuilt.test/still.jpg'],
        ['durationSeconds', 0],
        ['recordedOn', '2026-02-31'],
        ['projectId', 'not-a-uuid'],
        ['embedCode', '<iframe>'],
      ] as const) {
        const res = await callRoute(adminList, { method: 'POST', as: 'editor', body: { ...ok, [field]: value } });
        expect(res.status).toBe(422);
      }

      const unknownProject = await callRoute(adminList, {
        method: 'POST',
        as: 'editor',
        body: { ...ok, projectId: '00000000-0000-4000-8000-00000000dead' },
      });
      expect(unknownProject.status).toBe(422);
      expect(unknownProject.body.error.details[0].field).toBe('projectId');
    });

    it('adds, publishes and audits a video, and 409s the same film twice', async () => {
      const ridge = await project('ocean-ridge');
      const created = await callRoute(adminList, {
        method: 'POST',
        as: 'editor',
        body: {
          youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
          title: 'Ocean Ridge: one year on site',
          category: 'project_documentary',
          projectId: ridge,
          durationSeconds: 402,
          recordedOn: '2026-06-12',
        },
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        youtubeId: 'abcdefghijk',
        slug: 'ocean-ridge-one-year-on-site',
        published: false,
        durationSeconds: 402,
        recordedOn: '2026-06-12',
        project: { slug: 'ocean-ridge', isPublished: true },
      });
      expect(created.headers['cache-control']).toBe('no-store');

      const again = await callRoute(adminList, {
        method: 'POST',
        as: 'editor',
        body: { youtubeUrl: 'https://youtu.be/abcdefghijk', title: 'Same film', category: 'drone' },
      });
      expect(again.status).toBe(409);

      const published = await callRoute(adminItem, {
        method: 'PATCH',
        as: 'editor',
        query: { videoId: created.body.id },
        body: { published: true, featured: true, youtubeUrl: 'https://youtu.be/zyxwvutsrqp' },
      });
      expect(published.status).toBe(200);
      expect(published.body).toMatchObject({ published: true, featured: true, youtubeId: 'zyxwvutsrqp' });

      const unlinked = await callRoute(adminItem, {
        method: 'PATCH',
        as: 'editor',
        query: { videoId: created.body.id },
        body: { projectId: null },
      });
      expect(unlinked.body.project).toBeNull();

      const { rows } = await query<{ action: string; changes: Record<string, unknown> }>(
        `SELECT action, changes FROM audit_log WHERE entity_type = 'video' ORDER BY id`,
      );
      expect(rows.map((r) => r.action)).toEqual(['video.created', 'video.updated', 'video.updated']);
      expect(rows[1]!.changes).toMatchObject({
        published: true,
        previousYoutubeId: 'abcdefghijk',
        youtubeId: 'zyxwvutsrqp',
      });
    });

    it('answers 404 for an unknown video, 409 for a taken address and 422 for an empty update', async () => {
      const a = await videos.create(input({ title: 'Alpha' }));
      await videos.create(input({ title: 'Beta' }));

      const missing = await callRoute(adminItem, {
        method: 'PATCH',
        as: 'editor',
        query: { videoId: '00000000-0000-4000-8000-00000000dead' },
        body: { title: 'Gamma' },
      });
      expect(missing.status).toBe(404);

      const taken = await callRoute(adminItem, { method: 'PATCH', as: 'editor', query: { videoId: a.id }, body: { slug: 'beta' } });
      expect(taken.status).toBe(409);

      const empty = await callRoute(adminItem, { method: 'PATCH', as: 'editor', query: { videoId: a.id }, body: {} });
      expect(empty.status).toBe(422);

      const badLink = await callRoute(adminItem, {
        method: 'PATCH',
        as: 'editor',
        query: { videoId: a.id },
        body: { youtubeUrl: 'https://example.com/watch?v=abcdefghijk' },
      });
      expect(badLink.status).toBe(422);
    });

    it('lets only an administrator delete, and audits it', async () => {
      const video = await videos.create(input());

      const asEditor = await callRoute(adminItem, { method: 'DELETE', as: 'editor', query: { videoId: video.id } });
      expect(asEditor.status).toBe(403);

      const asAdmin = await callRoute(adminItem, { method: 'DELETE', as: 'admin', query: { videoId: video.id } });
      expect(asAdmin.status).toBe(204);
      expect(await videos.findById(video.id)).toBeNull();

      const again = await callRoute(adminItem, { method: 'DELETE', as: 'admin', query: { videoId: video.id } });
      expect(again.status).toBe(404);

      const row = await queryOne<{ action: string }>(`SELECT action FROM audit_log WHERE entity_type = 'video'`);
      expect(row!.action).toBe('video.deleted');
    });

    it('reorders the whole list and refuses a partial one', async () => {
      const a = await videos.create(input({ title: 'Alpha' }));
      const b = await videos.create(input({ title: 'Beta' }));

      const partial = await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id] } });
      expect(partial.status).toBe(422);

      const duplicate = await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id, b.id] } });
      expect(duplicate.status).toBe(422);

      const ok = await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id, a.id] } });
      expect(ok.status).toBe(200);
      expect(ok.body.results.map((v: { title: string }) => v.title)).toEqual(['Beta', 'Alpha']);

      expect((await callRoute(adminReorder, { method: 'POST', as: 'viewer', body: { ids: [a.id, b.id] } })).status).toBe(403);
    });
  });

  describe('public API', () => {
    it('lists published videos only, filtered and paginated, cacheable for a minute', async () => {
      const ridge = await project('ocean-ridge');
      await videos.create(input({ title: 'Ridge drone', category: 'drone', projectId: ridge, published: true }));
      await videos.create(input({ title: 'Ridge update', category: 'construction_update', projectId: ridge, published: true }));
      await videos.create(input({ title: 'Corporate film', category: 'corporate', published: true }));
      await videos.create(input({ title: 'Draft drone', category: 'drone' }));

      const all = await callRoute(publicList);
      expect(all.status).toBe(200);
      expect(all.body.results.map((v: { slug: string }) => v.slug)).toEqual(['ridge-drone', 'ridge-update', 'corporate-film']);
      expect(all.body.results[0]).not.toHaveProperty('published');
      expect(all.body.pagination).toMatchObject({ total: 3, page: 1, pageSize: 24 });
      expect(all.headers['cache-control']).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');

      const drone = await callRoute(publicList, { query: { category: 'drone' } });
      expect(drone.body.results.map((v: { slug: string }) => v.slug)).toEqual(['ridge-drone']);

      const byProject = await callRoute(publicList, { query: { project: 'ocean-ridge', q: 'update' } });
      expect(byProject.body.results.map((v: { slug: string }) => v.slug)).toEqual(['ridge-update']);

      const paged = await callRoute(publicList, { query: { pageSize: '2', page: '2' } });
      expect(paged.body.results.map((v: { slug: string }) => v.slug)).toEqual(['corporate-film']);

      const badCategory = await callRoute(publicList, { query: { category: 'bloopers' } });
      expect(badCategory.status).toBe(422);
    });

    it('serves a published video with related films, and 404s a draft whoever asks', async () => {
      const ridge = await project('ocean-ridge');
      await videos.create(input({ title: 'Ridge drone', category: 'drone', projectId: ridge, published: true }));
      await videos.create(input({ title: 'Ridge documentary', projectId: ridge, published: true }));
      await videos.create(input({ title: 'Hidden' }));

      const res = await callRoute(publicDetail, { query: { slug: 'ridge-documentary' } });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ slug: 'ridge-documentary', project: { slug: 'ocean-ridge' } });
      expect(res.body.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(res.body.related.map((v: { slug: string }) => v.slug)).toEqual(['ridge-drone']);

      const draft = await callRoute(publicDetail, { as: 'admin', query: { slug: 'hidden' } });
      expect(draft.status).toBe(404);
      expect(draft.headers['cache-control']).toBe('no-store');
    });
  });

  describe('pages', () => {
    it('read the published library, a video page, the latest interviews and a project’s films', async () => {
      const ridge = await project('ocean-ridge');
      await videos.create(input({ title: 'Ridge drone', category: 'drone', projectId: ridge, published: true }));
      await videos.create(input({ title: 'Ridge draft', projectId: ridge }));
      await videos.create(input({ title: 'Interview', category: 'leadership_interview', published: true }));

      expect((await loadLibrary())!.map((v) => v.slug)).toEqual(['ridge-drone', 'interview']);
      expect(await loadVideoPage('ridge-draft')).toEqual({ kind: 'not-found' });
      expect(await loadVideoPage('ridge-drone')).toMatchObject({ kind: 'found', video: { slug: 'ridge-drone' } });
      expect((await loadLatest('leadership_interview')).map((v) => v.slug)).toEqual(['interview']);

      const page = await loadProject('ocean-ridge');
      expect(page.kind).toBe('found');
      expect(page.kind === 'found' && page.props.videos.map((v) => v.slug)).toEqual(['ridge-drone']);
    });

    it('say the library is unavailable, rather than failing or claiming it is empty, when the query fails', async () => {
      await project('ocean-ridge');
      await query('ALTER TABLE videos RENAME TO videos_unavailable');
      try {
        expect(await loadLibrary()).toBeNull();
        expect(await loadVideoPage('anything')).toEqual({ kind: 'unavailable' });
        expect(await loadLatest('leadership_interview')).toEqual([]);
        // The project page still renders, without its films.
        const page = await loadProject('ocean-ridge');
        expect(page.kind === 'found' && page.props.videos).toEqual([]);
      } finally {
        await query('ALTER TABLE videos_unavailable RENAME TO videos');
      }
    });
  });
});
