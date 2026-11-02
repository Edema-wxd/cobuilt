import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { bearerFor, callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import * as leadership from '@/lib/repositories/leadership';
import { applyWebhook } from '@/lib/cms/sync';
import { loadLeader, loadPublishedLeaders } from '../../app/leadership/load-leadership';
import publicRoute from '../../pages/api/leadership';
import adminListRoute from '../../pages/api/admin/leadership/index';
import adminItemRoute from '../../pages/api/admin/leadership/[leaderId]';
import reorderRoute from '../../pages/api/admin/leadership/reorder';

describeWithDatabase('leadership profiles', () => {
  let editor: { id: string; email: string };

  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    editor = (await queryOne<{ id: string; email: string }>(
      `INSERT INTO users (email, full_name, role)
       VALUES ('leadership-editor@test.local', 'Leadership Editor', 'editor') RETURNING id, email`,
    ))!;
  });

  afterAll(async () => {
    await pool.end();
  });

  const asEditor = () => ({
    authorization: `Bearer ${bearerFor({ userId: editor.id, email: editor.email, role: 'editor' })}`,
  });

  const leader = (overrides: Partial<Parameters<typeof leadership.createLeader>[0]> = {}) =>
    leadership.createLeader({
      fullName: 'Adaeze Okafor',
      roleTitle: 'Managing Director',
      summary: 'Leads development strategy and the Passport standard.',
      bio: 'First paragraph.\n\nSecond paragraph.',
      qualifications: ['MSc Construction Management', 'FNIOB'],
      expertise: ['Development strategy', 'Capital structure'],
      photoUrl: 'https://cdn.example.com/adaeze.jpg',
      published: true,
      ...overrides,
    });

  describe('repository', () => {
    it('creates a draft by default, derives the slug and appends to the order', async () => {
      const first = await leadership.createLeader({ fullName: 'Adaeze Okafor', roleTitle: 'Managing Director' });
      const second = await leadership.createLeader({ fullName: 'Adaeze Okafor', roleTitle: 'Director' });

      expect(first.slug).toBe('adaeze-okafor');
      expect(second.slug).toBe('adaeze-okafor-2');
      expect(first.published).toBe(false);
      expect(first.featured).toBe(false);
      expect(first.tier).toBe('executive');
      expect(first.qualifications).toEqual([]);
      expect(second.sort_order).toBe(first.sort_order + 1);
    });

    it('lists published leaders only, in running order', async () => {
      const a = await leader({ fullName: 'Leader A' });
      const b = await leader({ fullName: 'Leader B' });
      await leader({ fullName: 'Draft Leader', published: false });

      await leadership.reorderLeadership([b.id, a.id, (await leadership.getLeaderBySlug('draft-leader', { includeUnpublished: true }))!.id]);

      const published = await leadership.listPublishedLeadership();
      expect(published.map((row) => row.full_name)).toEqual(['Leader B', 'Leader A']);
      expect(published[0]!.qualifications).toEqual(['MSc Construction Management', 'FNIOB']);
    });

    it('narrows to the homepage spotlight, and never shows a featured draft', async () => {
      await leader({ fullName: 'Featured Live', featured: true });
      await leader({ fullName: 'Featured Draft', featured: true, published: false });
      await leader({ fullName: 'Not Featured' });

      const spotlight = await leadership.listPublishedLeadership({ featured: true });
      expect(spotlight.map((row) => row.full_name)).toEqual(['Featured Live']);
      expect(await leadership.listPublishedLeadership({ limit: 1 })).toHaveLength(1);
    });

    it('finds a leader by slug, published only unless asked', async () => {
      await leader({ fullName: 'Draft Leader', published: false });

      expect(await leadership.getLeaderBySlug('draft-leader')).toBeNull();
      expect(await leadership.getLeaderBySlug('draft-leader', { includeUnpublished: true })).not.toBeNull();
    });

    it('updates only the fields given, and null clears one', async () => {
      const created = await leader();
      const updated = await leadership.updateLeader(created.id, {
        summary: null,
        expertise: ['Programme delivery'],
        socialLinks: { linkedin: 'https://www.linkedin.com/in/example' },
      });

      expect(updated!.summary).toBeNull();
      expect(updated!.expertise).toEqual(['Programme delivery']);
      expect(updated!.social_links).toEqual({ linkedin: 'https://www.linkedin.com/in/example' });
      expect(updated!.role_title).toBe('Managing Director');
      expect(await leadership.updateLeader('00000000-0000-4000-8000-0000000000ff', { featured: true })).toBeNull();
    });

    it('deletes a leader', async () => {
      const created = await leader();
      expect((await leadership.deleteLeader(created.id))!.id).toBe(created.id);
      expect(await leadership.getLeaderById(created.id)).toBeNull();
      expect(await leadership.deleteLeader(created.id)).toBeNull();
    });

    it('refuses a reorder built from a stale list', async () => {
      const a = await leader({ fullName: 'Leader A' });
      const b = await leader({ fullName: 'Leader B' });
      await leader({ fullName: 'Leader C' });

      expect(await leadership.reorderLeadership([b.id, a.id])).toBe(false);
      expect((await leadership.listAllLeadership()).map((row) => row.full_name)).toEqual([
        'Leader A',
        'Leader B',
        'Leader C',
      ]);
    });

    it('rejects a tier outside the organisational structure', async () => {
      await expect(
        query(`INSERT INTO leadership (full_name, slug, tier) VALUES ('X', 'x', 'chairman')`),
      ).rejects.toThrow(/leadership_tier_valid/);
    });
  });

  describe('page loaders', () => {
    it('serialises published leaders for the page and the spotlight', async () => {
      await leader({ featured: true, socialLinks: { linkedin: 'https://www.linkedin.com/in/example' } });
      await leader({ fullName: 'Draft Leader', published: false });

      const leaders = await loadPublishedLeaders();
      expect(leaders).toHaveLength(1);
      expect(leaders[0]).toMatchObject({
        fullName: 'Adaeze Okafor',
        roleTitle: 'Managing Director',
        expertise: ['Development strategy', 'Capital structure'],
        socialLinks: { linkedin: 'https://www.linkedin.com/in/example', x: null, website: null },
        featured: true,
      });
      expect(await loadPublishedLeaders({ featured: true })).toHaveLength(1);
      expect((await loadLeader('adaeze-okafor')).kind).toBe('found');
      expect((await loadLeader('draft-leader')).kind).toBe('not-found');
    });

    it('returns no leaders, rather than failing, when the query fails', async () => {
      await leader();
      await query('ALTER TABLE leadership RENAME TO leadership_unavailable');
      try {
        expect(await loadPublishedLeaders()).toEqual([]);
      } finally {
        await query('ALTER TABLE leadership_unavailable RENAME TO leadership');
      }
    });
  });

  describe('CMS sync', () => {
    const payload = (entry: Record<string, unknown>) => ({
      event: 'entry.publish' as const,
      model: 'leadership',
      entry: { id: 7, fullName: 'Chidi Eze', roleTitle: 'Construction Director', publishedAt: new Date().toISOString(), ...entry },
    });

    it('writes the profile fields, and revalidates the leadership pages', async () => {
      const result = await applyWebhook(
        payload({ summary: 'Runs the sites.', qualifications: ['BEng'], expertise: ['Site delivery'], tier: 'management', featured: true }),
        'delivery-1',
      );

      expect(result.status).toBe('applied');
      expect(result.revalidate).toEqual(expect.arrayContaining(['/leadership', '/leadership/chidi-eze']));

      const row = await leadership.getLeaderBySlug('chidi-eze');
      expect(row).toMatchObject({
        summary: 'Runs the sites.',
        qualifications: ['BEng'],
        expertise: ['Site delivery'],
        tier: 'management',
        featured: true,
        published: true,
      });
      expect(row!.cms_synced_at).not.toBeNull();
    });

    it('keeps console values for fields an older CMS model does not send', async () => {
      await applyWebhook(payload({}), 'delivery-1');
      const row = await leadership.getLeaderBySlug('chidi-eze');
      await leadership.updateLeader(row!.id, { featured: true, expertise: ['Site delivery'], tier: 'board' });

      await applyWebhook(payload({ roleTitle: 'Director of Construction', tier: 'not-a-tier' }), 'delivery-2');

      expect(await leadership.getLeaderById(row!.id)).toMatchObject({
        role_title: 'Director of Construction',
        featured: true,
        expertise: ['Site delivery'],
        tier: 'board',
      });
    });
  });

  describe('GET /api/leadership', () => {
    it('returns published leaders only, in public shape', async () => {
      await leader({ featured: true });
      await leader({ fullName: 'Draft Leader', published: false });

      const { status, body, headers } = await callRoute(publicRoute);

      expect(status).toBe(200);
      expect(body.results).toHaveLength(1);
      expect(body.results[0]).toMatchObject({ fullName: 'Adaeze Okafor', slug: 'adaeze-okafor' });
      expect(body.results[0]).not.toHaveProperty('published');
      expect(body.results[0]).not.toHaveProperty('cms');
      expect(headers['cache-control']).toContain('s-maxage=60');
    });

    it('filters to the spotlight', async () => {
      await leader({ featured: true });
      await leader({ fullName: 'Not Featured' });

      const { body } = await callRoute(publicRoute, { query: { featured: 'true' } });
      expect(body.results.map((r: { fullName: string }) => r.fullName)).toEqual(['Adaeze Okafor']);
    });
  });

  describe('admin API', () => {
    const valid = {
      fullName: 'Ngozi Bello',
      roleTitle: 'Commercial Director',
      qualifications: ['ACA'],
      expertise: ['Procurement'],
      photoUrl: 'https://cdn.example.com/ngozi.jpg',
    };

    it('lets an editor create a profile, as a draft, and audits it', async () => {
      const { status, body } = await callRoute(adminListRoute, {
        method: 'POST',
        headers: asEditor(),
        body: valid,
      });

      expect(status).toBe(201);
      expect(body).toMatchObject({ fullName: 'Ngozi Bello', slug: 'ngozi-bello', published: false });

      const entry = await queryOne<{ actor_id: string; entity_id: string }>(
        `SELECT actor_id, entity_id FROM audit_log WHERE action = 'leadership.created'`,
      );
      expect(entry).toEqual({ actor_id: editor.id, entity_id: body.id });

      // A draft is not public.
      expect((await callRoute(publicRoute)).body.results).toHaveLength(0);
    });

    it('requires leadership:write', async () => {
      expect((await callRoute(adminListRoute, { method: 'POST', as: 'viewer', body: valid })).status).toBe(403);
      expect((await callRoute(adminListRoute, { as: 'viewer' })).status).toBe(403);
      expect((await callRoute(adminListRoute, { method: 'POST', body: valid })).status).toBe(401);
      expect((await callRoute(publicRoute)).status).toBe(200);
    });

    it('rejects invalid input field by field', async () => {
      const http = await callRoute(adminListRoute, {
        method: 'POST',
        headers: asEditor(),
        body: { ...valid, photoUrl: 'http://cdn.example.com/ngozi.jpg' },
      });
      expect(http.status).toBe(422);
      expect(http.body.error.details[0].field).toBe('photoUrl');

      const missing = await callRoute(adminListRoute, {
        method: 'POST',
        headers: asEditor(),
        body: { roleTitle: 'Director' },
      });
      expect(missing.status).toBe(422);
      expect(missing.body.error.details[0].field).toBe('fullName');

      const unknown = await callRoute(adminListRoute, {
        method: 'POST',
        headers: asEditor(),
        body: { ...valid, published_at: '2026-01-01' },
      });
      expect(unknown.status).toBe(422);

      const tier = await callRoute(adminListRoute, {
        method: 'POST',
        headers: asEditor(),
        body: { ...valid, tier: 'chairman' },
      });
      expect(tier.status).toBe(422);
      expect(tier.body.error.details[0].field).toBe('tier');
    });

    it('lists drafts to staff, and publishing shows the profile publicly', async () => {
      const draft = await leader({ published: false });

      const list = await callRoute(adminListRoute, { headers: asEditor() });
      expect(list.status).toBe(200);
      expect(list.body.results).toHaveLength(1);
      expect(list.headers['cache-control']).toBeUndefined();

      const published = await callRoute(adminItemRoute, {
        method: 'PATCH',
        headers: asEditor(),
        query: { leaderId: draft.id },
        body: { published: true, featured: true },
      });
      expect(published.status).toBe(200);
      expect(published.body).toMatchObject({ published: true, featured: true });

      const audit = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'leadership.updated'`,
      );
      expect(audit!.changes).toMatchObject({ fields: ['published', 'featured'], published: true });

      const publicList = await callRoute(publicRoute, { query: { featured: 'true' } });
      expect(publicList.body.results.map((r: { id: string }) => r.id)).toEqual([draft.id]);
    });

    it('reads one profile, and 404s an unknown id', async () => {
      const created = await leader();
      const found = await callRoute(adminItemRoute, { headers: asEditor(), query: { leaderId: created.id } });
      expect(found.body.fullName).toBe('Adaeze Okafor');

      const missing = await callRoute(adminItemRoute, {
        method: 'PATCH',
        headers: asEditor(),
        query: { leaderId: '00000000-0000-4000-8000-0000000000ff' },
        body: { featured: true },
      });
      expect(missing.status).toBe(404);
    });

    it('answers a taken web address with 409', async () => {
      await leader();
      const other = await leader({ fullName: 'Someone Else' });

      const { status } = await callRoute(adminItemRoute, {
        method: 'PATCH',
        headers: asEditor(),
        query: { leaderId: other.id },
        body: { slug: 'adaeze-okafor' },
      });
      expect(status).toBe(409);
    });

    it('rejects an empty update', async () => {
      const created = await leader();
      const { status } = await callRoute(adminItemRoute, {
        method: 'PATCH',
        headers: asEditor(),
        query: { leaderId: created.id },
        body: {},
      });
      expect(status).toBe(422);
    });

    it('lets only an admin delete', async () => {
      const created = await leader();

      const asEditorResult = await callRoute(adminItemRoute, {
        method: 'DELETE',
        headers: asEditor(),
        query: { leaderId: created.id },
      });
      expect(asEditorResult.status).toBe(403);

      const asAdmin = await callRoute(adminItemRoute, {
        method: 'DELETE',
        as: 'admin',
        query: { leaderId: created.id },
      });
      expect(asAdmin.status).toBe(204);
      expect(await leadership.getLeaderById(created.id)).toBeNull();
    });

    it('reorders from the complete list, and 409s a stale one', async () => {
      const a = await leader({ fullName: 'Leader A' });
      const b = await leader({ fullName: 'Leader B' });

      const ok = await callRoute(reorderRoute, {
        method: 'POST',
        headers: asEditor(),
        body: { ids: [b.id, a.id] },
      });
      expect(ok.status).toBe(200);
      expect(ok.body.results.map((r: { fullName: string }) => r.fullName)).toEqual(['Leader B', 'Leader A']);

      const stale = await callRoute(reorderRoute, {
        method: 'POST',
        headers: asEditor(),
        body: { ids: [a.id] },
      });
      expect(stale.status).toBe(409);

      const duplicate = await callRoute(reorderRoute, {
        method: 'POST',
        headers: asEditor(),
        body: { ids: [a.id, a.id] },
      });
      expect(duplicate.status).toBe(422);

      expect(
        (await callRoute(reorderRoute, { method: 'POST', as: 'viewer', body: { ids: [a.id, b.id] } })).status,
      ).toBe(403);
    });
  });
});
