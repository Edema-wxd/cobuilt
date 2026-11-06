import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import * as redirects from '@/lib/repositories/redirects';
import { RedirectLoopError } from '@/lib/repositories/redirects';
import { findRedirect, forgetRedirectRules, recordHit } from '@/lib/redirects';
import { createRedirectBody } from '@/lib/schemas/redirects';
import adminList from '../../pages/api/admin/redirects/index';
import adminItem from '../../pages/api/admin/redirects/[redirectId]';

/** The account the test bearer tokens carry (setup/helpers.ts), so rows can reference it. */
const ACTOR_ID = '00000000-0000-4000-8000-000000000001';

describeWithDatabase('redirects', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await truncateAll();
    forgetRedirectRules();
    await query(
      `INSERT INTO users (id, email, full_name, role) VALUES ($1, 'admin@cobuilt.test', 'Test Admin', 'admin')`,
      [ACTOR_ID],
    );
  });

  const rule = (sourcePath: string, destination: string, permanent = true) =>
    redirects.create(createRedirectBody.parse({ sourcePath, destination, permanent }), ACTOR_ID);

  describe('repository', () => {
    it('stores a normalised source, the landing path, and starts the count at zero', async () => {
      const created = await rule('/About-Us/', '/about?from=old');

      expect(created).toMatchObject({
        sourcePath: '/about-us',
        destination: '/about?from=old',
        permanent: true,
        hitCount: 0,
        lastHitAt: null,
      });
      const row = await queryOne<{ destination_path: string; created_by: string }>(
        `SELECT destination_path, created_by FROM redirects WHERE id = $1`,
        [created.id],
      );
      expect(row).toEqual({ destination_path: '/about', created_by: ACTOR_ID });
    });

    it('refuses a second rule for the same source', async () => {
      await rule('/old', '/new');
      await expect(rule('/OLD/', '/elsewhere')).rejects.toMatchObject({ code: '23505' });
    });

    it('allows one hop only: no chain, and so no loop', async () => {
      await rule('/a', '/b');

      // /b is where /a lands, so it cannot send visitors on again.
      await expect(rule('/b', '/c')).rejects.toBeInstanceOf(RedirectLoopError);
      await expect(rule('/b', '/c')).rejects.toMatchObject({ field: 'sourcePath' });
      // /a is redirected, so nothing may land on it.
      await expect(rule('/c', '/a')).rejects.toMatchObject({ field: 'destination' });
      // The same, through an absolute link to this site.
      await expect(rule('/c', 'https://www.cobuiltpartners.com/A/')).rejects.toMatchObject({ field: 'destination' });
      // Another site is never part of a chain here.
      await expect(rule('/c', 'https://partner.example.com/a')).resolves.toMatchObject({ sourcePath: '/c' });
    });

    it('checks an edit for loops against the other rules, not against itself', async () => {
      const a = await rule('/a', '/b');
      const c = await rule('/c', '/d');

      await expect(redirects.update(a.id, { permanent: false })).resolves.toMatchObject({ permanent: false });
      await expect(redirects.update(a.id, { destination: { destination: '/c', sitePath: '/c' } })).rejects.toMatchObject({
        field: 'destination',
      });
      await expect(redirects.update(c.id, { sourcePath: '/b' })).rejects.toMatchObject({ field: 'sourcePath' });
      await expect(redirects.update(a.id, { sourcePath: '/b' })).rejects.toMatchObject({ field: 'destination' });
      expect(await redirects.update('00000000-0000-4000-8000-00000000dead', { permanent: true })).toBeNull();
    });

    it('holds the rules at the database too', async () => {
      for (const [source, destination] of [
        ['relative', '/x'],
        ['/admin/users', '/x'],
        ['/', '/x'],
        ['/x', 'javascript:alert(1)'],
        ['/x', '/x'],
      ]) {
        await expect(
          query(`INSERT INTO redirects (source_path, destination, destination_path) VALUES ($1, $2, $2)`, [
            source,
            destination,
          ]),
        ).rejects.toMatchObject({ code: '23514' });
      }
    });

    it('counts a hit without moving "last edited"', async () => {
      const created = await rule('/old', '/new');
      await redirects.recordHit(created.id);
      await redirects.recordHit(created.id);

      const after = (await redirects.findById(created.id))!;
      expect(after.hitCount).toBe(2);
      expect(after.lastHitAt).not.toBeNull();
      expect(after.updatedAt).toBe(created.updatedAt);
    });
  });

  describe('lookup', () => {
    it('finds a rule however the address is written, and never for the console or the API', async () => {
      await rule('/about-us.html', '/about', false);

      expect(await findRedirect('/About-Us.html/?utm_source=old')).toMatchObject({
        destination: '/about',
        permanent: false,
      });
      expect(await findRedirect('/about-us')).toBeNull();
      expect(await findRedirect('/admin')).toBeNull();
      expect(await findRedirect('/api/health')).toBeNull();
    });

    it('holds the rules for a minute, and sees a console write at once', async () => {
      expect(await findRedirect('/old')).toBeNull();
      await rule('/old', '/new');
      // Still the copy from before the write: nothing told this process.
      expect(await findRedirect('/old')).toBeNull();
      forgetRedirectRules();
      expect(await findRedirect('/old')).toMatchObject({ destination: '/new' });
    });

    it('answers "no redirect" rather than failing when the database is down, and keeps rules it already had', async () => {
      await rule('/old', '/new');
      expect(await findRedirect('/old')).not.toBeNull();

      await query('ALTER TABLE redirects RENAME TO redirects_unavailable');
      try {
        // The copy has expired: the reload fails and the last rules known stand.
        globalThis.__cobuiltRedirectRules!.expiresAt = 0;
        expect(await findRedirect('/old')).toMatchObject({ destination: '/new' });

        // With nothing known before the outage, there is simply no redirect.
        forgetRedirectRules();
        await expect(findRedirect('/old')).resolves.toBeNull();
      } finally {
        await query('ALTER TABLE redirects_unavailable RENAME TO redirects');
      }
    });

    it('counts a hit, and swallows a failure to', async () => {
      const created = await rule('/old', '/new');
      const found = (await findRedirect('/old'))!;
      await recordHit(found);
      expect((await redirects.findById(created.id))!.hitCount).toBe(1);

      await query('ALTER TABLE redirects RENAME TO redirects_unavailable');
      try {
        await expect(recordHit(found)).resolves.toBeUndefined();
      } finally {
        await query('ALTER TABLE redirects_unavailable RENAME TO redirects');
      }
    });
  });

  describe('admin API', () => {
    it('is for admins only', async () => {
      expect((await callRoute(adminList)).status).toBe(401);
      for (const role of ['editor', 'viewer', 'investor'] as const) {
        expect((await callRoute(adminList, { as: role })).status).toBe(403);
        expect(
          (await callRoute(adminList, { as: role, method: 'POST', body: { sourcePath: '/old', destination: '/new' } }))
            .status,
        ).toBe(403);
      }
      expect(await query(`SELECT 1 FROM redirects`)).toMatchObject({ rowCount: 0 });

      const res = await callRoute(adminList, { as: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ results: [] });
    });

    it('adds a rule, audited, and lists it with its count', async () => {
      const created = await callRoute(adminList, {
        method: 'POST',
        as: 'admin',
        body: { sourcePath: '/Projects/Old-Ridge', destination: '/projects/ocean-ridge', permanent: true },
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ sourcePath: '/projects/old-ridge', hitCount: 0 });

      const audit = await queryOne<{ action: string; entity_id: string; changes: Record<string, unknown> }>(
        `SELECT action, entity_id, changes FROM audit_log WHERE entity_type = 'redirect'`,
      );
      expect(audit).toEqual({
        action: 'redirect.created',
        entity_id: created.body.id,
        changes: { sourcePath: '/projects/old-ridge', destination: '/projects/ocean-ridge', permanent: true },
      });

      const list = await callRoute(adminList, { as: 'admin' });
      expect(list.body.results.map((r: { sourcePath: string }) => r.sourcePath)).toEqual(['/projects/old-ridge']);
    });

    it.each([
      [{ sourcePath: 'old', destination: '/new' }, 'sourcePath'],
      [{ sourcePath: '/admin/users', destination: '/new' }, 'sourcePath'],
      [{ sourcePath: '/api/projects', destination: '/new' }, 'sourcePath'],
      [{ sourcePath: '/old?x=1', destination: '/new' }, 'sourcePath'],
      [{ sourcePath: '/old', destination: 'javascript:alert(1)' }, 'destination'],
      [{ sourcePath: '/old', destination: '//evil.example' }, 'destination'],
      [{ sourcePath: '/old', destination: '/Old/' }, 'destination'],
      [{ sourcePath: '/old', destination: '/new', extra: true }, ''],
      [{ destination: '/new' }, 'sourcePath'],
    ])('refuses %j with a 422', async (body, field) => {
      const res = await callRoute(adminList, { method: 'POST', as: 'admin', body });
      expect(res.status).toBe(422);
      if (field) {
        expect(JSON.stringify(res.body.error.details)).toContain(field);
      }
    });

    it('refuses a loop with a 422 naming the field, and a duplicate source with a 409', async () => {
      await callRoute(adminList, { method: 'POST', as: 'admin', body: { sourcePath: '/a', destination: '/b' } });

      const loop = await callRoute(adminList, { method: 'POST', as: 'admin', body: { sourcePath: '/b', destination: '/a' } });
      expect(loop.status).toBe(422);
      expect(loop.body.error.details[0]).toMatchObject({ field: 'sourcePath' });
      expect(loop.body.error.details[0].message).toContain('/a already redirects here');

      const chain = await callRoute(adminList, { method: 'POST', as: 'admin', body: { sourcePath: '/c', destination: '/a' } });
      expect(chain.status).toBe(422);
      expect(chain.body.error.details[0]).toMatchObject({ field: 'destination' });

      const duplicate = await callRoute(adminList, { method: 'POST', as: 'admin', body: { sourcePath: '/A/', destination: '/d' } });
      expect(duplicate.status).toBe(409);
    });

    it('edits and deletes a rule, audited, and keeps its count through an edit', async () => {
      const created = (
        await callRoute(adminList, { method: 'POST', as: 'admin', body: { sourcePath: '/old', destination: '/new' } })
      ).body;
      await redirects.recordHit(created.id);

      expect((await callRoute(adminItem, { as: 'editor', query: { redirectId: created.id } })).status).toBe(403);

      const patched = await callRoute(adminItem, {
        method: 'PATCH',
        as: 'admin',
        query: { redirectId: created.id },
        body: { destination: 'https://partner.example.com/new', permanent: false },
      });
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ destination: 'https://partner.example.com/new', permanent: false, hitCount: 1 });

      const empty = await callRoute(adminItem, { method: 'PATCH', as: 'admin', query: { redirectId: created.id }, body: {} });
      expect(empty.status).toBe(422);

      const removed = await callRoute(adminItem, { method: 'DELETE', as: 'admin', query: { redirectId: created.id } });
      expect(removed.status).toBe(204);
      expect((await callRoute(adminItem, { as: 'admin', query: { redirectId: created.id } })).status).toBe(404);

      const { rows } = await query<{ action: string; changes: Record<string, unknown> }>(
        `SELECT action, changes FROM audit_log WHERE entity_type = 'redirect' ORDER BY id`,
      );
      expect(rows.map((row) => row.action)).toEqual(['redirect.created', 'redirect.updated', 'redirect.deleted']);
      expect(rows[1]!.changes).toMatchObject({
        fields: ['destination', 'permanent'],
        previousDestination: '/new',
        destination: 'https://partner.example.com/new',
        permanent: false,
      });
      expect(rows[2]!.changes).toMatchObject({ sourcePath: '/old', hitCount: 1 });
    });

    it('takes effect in the lookup at once after a console write', async () => {
      expect(await findRedirect('/old')).toBeNull();
      await callRoute(adminList, { method: 'POST', as: 'admin', body: { sourcePath: '/old', destination: '/new' } });
      expect(await findRedirect('/old')).toMatchObject({ destination: '/new' });
    });
  });
});
