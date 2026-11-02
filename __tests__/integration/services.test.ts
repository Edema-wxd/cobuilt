import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import * as services from '@/lib/repositories/services';
import { createServiceBody } from '@/lib/schemas/services';
import publicList from '../../pages/api/services/index';
import publicDetail from '../../pages/api/services/[slug]';
import adminList from '../../pages/api/admin/services/index';
import adminItem from '../../pages/api/admin/services/[serviceId]/index';
import adminProjects from '../../pages/api/admin/services/[serviceId]/projects';
import adminReorder from '../../pages/api/admin/services/reorder';
import { SERVICES } from '../../app/services/services';
import { loadServiceCards, loadServicePage } from '../../app/services/load-services';

/** The account the test bearer tokens carry (setup/helpers.ts), so audit rows can reference it. */
const ACTOR_ID = '00000000-0000-4000-8000-000000000001';

describeWithDatabase('services', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  describe('migration seed', () => {
    // Runs before anything truncates: these are the rows 0015 inserted.
    it('holds the six static services verbatim, published, in their original order', async () => {
      const published = await services.listPublished();
      expect(published.map((s) => s.slug)).toEqual(SERVICES.map((s) => s.slug));

      for (const expected of SERVICES) {
        const actual = await services.findPublishedBySlug(expected.slug);
        expect(actual).toMatchObject({
          slug: expected.slug,
          title: expected.title,
          summary: expected.summary,
          standfirst: expected.standfirst,
          body: expected.body,
          covers: expected.covers,
          deliverables: expected.deliverables,
          suitedTo: expected.suitedTo,
          informational: expected.informational ?? false,
          process: [],
          benefits: [],
        });
      }
    });

    it('renders the service pages from the database exactly as from the static copy', async () => {
      const page = await loadServicePage('property-investment');
      const fallback = SERVICES.find((s) => s.slug === 'property-investment')!;
      expect(page?.service).toEqual({
        ...fallback,
        process: [],
        benefits: [],
        metaTitle: null,
        metaDescription: null,
      });
      expect(page?.others.map((s) => s.slug)).toEqual(
        SERVICES.filter((s) => s.slug !== 'property-investment').map((s) => s.slug),
      );
    });
  });

  describe('after the seed', () => {
    beforeEach(async () => {
      await truncateAll();
      await query(
        `INSERT INTO users (id, email, full_name, role) VALUES ($1, 'editor@cobuilt.test', 'Test Editor', 'editor')`,
        [ACTOR_ID],
      );
    });

    const input = (overrides: Record<string, unknown> = {}) =>
      createServiceBody.parse({
        title: 'Feasibility Studies',
        summary: 'Whether a scheme stacks up, before anyone commits to it.',
        ...overrides,
      });

    async function project(slug: string, publishedAt: string | null = new Date().toISOString()) {
      return (await queryOne<{ id: string }>(
        `INSERT INTO projects (title, slug, status, published_at) VALUES ($1, $2, 'completed', $3) RETURNING id`,
        [slug.replace(/-/g, ' '), slug, publishedAt],
      ))!.id;
    }

    describe('repository', () => {
      it('creates a draft at the end of the list with a slug from the title', async () => {
        const first = await services.create(input({ published: true }));
        const second = await services.create(input({ title: 'Design Management' }));

        expect(second).toMatchObject({ slug: 'design-management', published: false, informational: false });
        expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
        expect((await services.listAll()).map((s) => s.slug)).toEqual([
          'feasibility-studies',
          'design-management',
        ]);
      });

      it('keeps drafts off every public read', async () => {
        await services.create(input({ title: 'Draft', published: false }));
        await services.create(input({ title: 'Live', published: true }));

        expect((await services.listPublished()).map((s) => s.slug)).toEqual(['live']);
        expect(await services.findPublishedBySlug('draft')).toBeNull();
      });

      it('round-trips the process and benefits lists and updates only the fields given', async () => {
        const created = await services.create(input());
        const updated = await services.update(created.id, {
          process: [
            { title: 'Brief', body: 'We agree what the study must answer.' },
            { title: 'Report', body: '' },
          ],
          benefits: [{ title: 'A clear no', body: 'Before money is spent.' }],
          metaTitle: 'Feasibility studies in Lagos',
        });

        expect(updated).toMatchObject({
          title: 'Feasibility Studies',
          summary: created.summary,
          process: [
            { title: 'Brief', body: 'We agree what the study must answer.' },
            { title: 'Report', body: '' },
          ],
          benefits: [{ title: 'A clear no', body: 'Before money is spent.' }],
          seo: { metaTitle: 'Feasibility studies in Lagos', metaDescription: null },
        });
        expect(await services.update('00000000-0000-4000-8000-00000000dead', { title: 'Nope' })).toBeNull();
      });

      it('reorders only when given every service exactly once', async () => {
        const a = await services.create(input({ title: 'Alpha' }));
        const b = await services.create(input({ title: 'Beta' }));
        const c = await services.create(input({ title: 'Gamma' }));

        expect(await services.reorder([c.id, a.id])).toBe(false);
        expect(await services.reorder([c.id, a.id, b.id])).toBe(true);
        expect((await services.listAll()).map((s) => s.title)).toEqual(['Gamma', 'Alpha', 'Beta']);
      });

      it('shows only live projects on the page, case studies apart, in the chosen order', async () => {
        const service = await services.create(input({ published: true }));
        const live1 = await project('ocean-ridge');
        const live2 = await project('kingsway');
        const draft = await project('northgate', null);
        const deleted = await project('old-scheme');
        await query(`UPDATE projects SET deleted_at = NOW() WHERE id = $1`, [deleted]);

        expect(
          await services.setProjects(service.id, [
            { projectId: live2, caseStudy: false },
            { projectId: draft, caseStudy: true },
            { projectId: live1, caseStudy: true },
          ]),
        ).toEqual({ missing: [] });

        const page = await services.publishedProjectsFor(service.id);
        expect(page.caseStudies.map((p) => p.slug)).toEqual(['ocean-ridge']);
        expect(page.relatedProjects.map((p) => p.slug)).toEqual(['kingsway']);

        // The console sees the draft too, flagged.
        const all = await services.projectsFor(service.id);
        expect(all.map((p) => [p.slug, p.isPublished])).toEqual([
          ['kingsway', true],
          ['northgate', false],
          ['ocean-ridge', true],
        ]);

        // A deleted project is refused and nothing changes.
        expect(await services.setProjects(service.id, [{ projectId: deleted, caseStudy: false }])).toEqual({
          missing: [deleted],
        });
        expect(await services.projectsFor(service.id)).toHaveLength(3);
      });

      it('removes a deleted service from its page projects and from project tags', async () => {
        const service = await services.create(input());
        const keep = await services.create(input({ title: 'Keep' }));
        const tagged = await project('tagged');
        await query(`UPDATE projects SET service_ids = ARRAY[$1, $2]::uuid[] WHERE id = $3`, [
          service.id,
          keep.id,
          tagged,
        ]);
        await services.setProjects(service.id, [{ projectId: tagged, caseStudy: true }]);

        expect(await services.remove(service.id)).toMatchObject({ id: service.id, slug: 'feasibility-studies' });
        expect(await services.remove(service.id)).toBeNull();

        const row = await queryOne<{ service_ids: string[] }>(`SELECT service_ids FROM projects WHERE id = $1`, [tagged]);
        expect(row!.service_ids).toEqual([keep.id]);
        expect((await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM service_projects`))!.n).toBe(0);
      });
    });

    describe('admin API', () => {
      it('requires services:write: anonymous 401, viewer 403, editor 200', async () => {
        expect((await callRoute(adminList)).status).toBe(401);
        expect((await callRoute(adminList, { as: 'viewer' })).status).toBe(403);
        expect((await callRoute(adminList, { as: 'investor' })).status).toBe(403);

        const res = await callRoute(adminList, { as: 'editor' });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ results: [] });
      });

      it('validates a new service field by field', async () => {
        const missing = await callRoute(adminList, { method: 'POST', as: 'editor', body: { title: 'X' } });
        expect(missing.status).toBe(422);
        expect(missing.body.error.details.map((d: { field: string }) => d.field)).toEqual(
          expect.arrayContaining(['title', 'summary']),
        );

        const unknown = await callRoute(adminList, {
          method: 'POST',
          as: 'editor',
          body: { title: 'Valid title', summary: 'Valid.', price: 100 },
        });
        expect(unknown.status).toBe(422);

        const badStep = await callRoute(adminList, {
          method: 'POST',
          as: 'editor',
          body: { title: 'Valid title', summary: 'Valid.', process: [{ body: 'No title' }] },
        });
        expect(badStep.status).toBe(422);
        expect(badStep.body.error.details[0].field).toBe('process.0.title');
      });

      it('creates, publishes and audits a service', async () => {
        const created = await callRoute(adminList, {
          method: 'POST',
          as: 'editor',
          body: { title: 'Investment Partnerships', summary: 'Information only.', informational: true },
        });
        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({ slug: 'investment-partnerships', published: false, informational: true });
        expect(created.headers['cache-control']).toBe('no-store');

        const published = await callRoute(adminItem, {
          method: 'PATCH',
          as: 'editor',
          query: { serviceId: created.body.id },
          body: { published: true, standfirst: 'How partnership would work.' },
        });
        expect(published.status).toBe(200);
        expect(published.body).toMatchObject({ published: true, standfirst: 'How partnership would work.', projects: [] });

        const { rows } = await query<{ action: string; changes: Record<string, unknown> }>(
          `SELECT action, changes FROM audit_log WHERE entity_type = 'service' ORDER BY id`,
        );
        expect(rows.map((r) => r.action)).toEqual(['service.created', 'service.updated']);
        expect(rows[1]!.changes).toMatchObject({ published: true });
      });

      it('answers 404 for an unknown service and 409 for a taken address', async () => {
        const a = await services.create(input({ title: 'Alpha' }));
        await services.create(input({ title: 'Beta' }));

        const missing = await callRoute(adminItem, {
          method: 'PATCH',
          as: 'editor',
          query: { serviceId: '00000000-0000-4000-8000-00000000dead' },
          body: { title: 'Gamma' },
        });
        expect(missing.status).toBe(404);

        const taken = await callRoute(adminItem, {
          method: 'PATCH',
          as: 'editor',
          query: { serviceId: a.id },
          body: { slug: 'beta' },
        });
        expect(taken.status).toBe(409);

        const empty = await callRoute(adminItem, { method: 'PATCH', as: 'editor', query: { serviceId: a.id }, body: {} });
        expect(empty.status).toBe(422);
      });

      it('lets only an administrator delete', async () => {
        const service = await services.create(input());

        const asEditor = await callRoute(adminItem, { method: 'DELETE', as: 'editor', query: { serviceId: service.id } });
        expect(asEditor.status).toBe(403);

        const asAdmin = await callRoute(adminItem, { method: 'DELETE', as: 'admin', query: { serviceId: service.id } });
        expect(asAdmin.status).toBe(204);
        expect(await services.findById(service.id)).toBeNull();
      });

      it('reorders the whole list and refuses a partial one', async () => {
        const a = await services.create(input({ title: 'Alpha' }));
        const b = await services.create(input({ title: 'Beta' }));

        const partial = await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id] } });
        expect(partial.status).toBe(422);

        const duplicate = await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id, b.id] } });
        expect(duplicate.status).toBe(422);

        const ok = await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id, a.id] } });
        expect(ok.status).toBe(200);
        expect(ok.body.results.map((s: { title: string }) => s.title)).toEqual(['Beta', 'Alpha']);

        expect((await callRoute(adminReorder, { method: 'POST', as: 'viewer', body: { ids: [a.id, b.id] } })).status).toBe(403);
      });

      it('sets the related projects and rejects an unknown project', async () => {
        const service = await services.create(input());
        const live = await project('ocean-ridge');

        const unknown = await callRoute(adminProjects, {
          method: 'PUT',
          as: 'editor',
          query: { serviceId: service.id },
          body: { projects: [{ projectId: live }, { projectId: '00000000-0000-4000-8000-00000000dead' }] },
        });
        expect(unknown.status).toBe(422);
        expect(unknown.body.error.details[0].field).toBe('projects.1.projectId');

        const ok = await callRoute(adminProjects, {
          method: 'PUT',
          as: 'editor',
          query: { serviceId: service.id },
          body: { projects: [{ projectId: live, caseStudy: true }] },
        });
        expect(ok.status).toBe(200);
        expect(ok.body.results).toEqual([expect.objectContaining({ slug: 'ocean-ridge', caseStudy: true, isPublished: true })]);

        const detail = await callRoute(adminItem, { as: 'editor', query: { serviceId: service.id } });
        expect(detail.body.projects).toHaveLength(1);
      });
    });

    describe('public API', () => {
      it('lists published services only, in display order, cacheable for a minute', async () => {
        const b = await services.create(input({ title: 'Beta', published: true }));
        const a = await services.create(input({ title: 'Alpha', published: true }));
        await services.create(input({ title: 'Draft' }));
        await services.reorder([a.id, b.id, (await services.listAll())[2]!.id]);

        const res = await callRoute(publicList);
        expect(res.status).toBe(200);
        expect(res.body.results.map((s: { slug: string }) => s.slug)).toEqual(['alpha', 'beta']);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      });

      it('serves a published service with its live projects, and 404s a draft', async () => {
        const live = await services.create(input({ published: true }));
        await services.create(input({ title: 'Hidden' }));
        await services.setProjects(live.id, [
          { projectId: await project('case-study'), caseStudy: true },
          { projectId: await project('related'), caseStudy: false },
          { projectId: await project('not-yet', null), caseStudy: false },
        ]);

        const res = await callRoute(publicDetail, { query: { slug: 'feasibility-studies' } });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ slug: 'feasibility-studies', title: 'Feasibility Studies' });
        expect(res.body).not.toHaveProperty('published');
        expect(res.body.caseStudies.map((p: { slug: string }) => p.slug)).toEqual(['case-study']);
        expect(res.body.relatedProjects.map((p: { slug: string }) => p.slug)).toEqual(['related']);

        const draft = await callRoute(publicDetail, { query: { slug: 'hidden' } });
        expect(draft.status).toBe(404);
        // An error is never stored by a shared cache.
        expect(draft.headers['cache-control']).toBe('no-store');
      });

      it('ignores a token: staff get the same published-only view', async () => {
        await services.create(input({ title: 'Hidden' }));
        const res = await callRoute(publicDetail, { as: 'admin', query: { slug: 'hidden' } });
        expect(res.status).toBe(404);
      });
    });

    describe('pages', () => {
      it('read the console’s services when the database is up', async () => {
        await services.create(input({ title: 'Design Management', published: true }));
        await services.create(input({ title: 'Draft' }));

        expect((await loadServiceCards()).map((s) => s.slug)).toEqual(['design-management']);
        expect(await loadServicePage('draft')).toBeNull();
        expect(await loadServicePage('real-estate-development')).toBeNull();
      });

      it('fall back to the built-in six, rather than failing, when the query fails', async () => {
        await query('ALTER TABLE services RENAME TO services_unavailable');
        try {
          expect((await loadServiceCards()).map((s) => s.slug)).toEqual(SERVICES.map((s) => s.slug));
          const page = await loadServicePage('construction-management');
          expect(page?.service.title).toBe('Construction Management');
          expect(page?.caseStudies).toEqual([]);
          expect(await loadServicePage('no-such-service')).toBeNull();
        } finally {
          await query('ALTER TABLE services_unavailable RENAME TO services');
        }
      });
    });
  });
});
