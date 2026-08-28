import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query, queryOne } from '@/lib/db';
import * as projects from '@/lib/repositories/projects';
import * as passport from '@/lib/repositories/passport';
import { serializeProject } from '@/lib/serializers';

describeWithDatabase('projects repository', () => {
  let adminId: string;

  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();

    const user = await queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ('admin@test.local', 'x', 'Test Admin', 'admin') RETURNING id`,
    );
    adminId = user!.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  async function seedProject(overrides: Partial<Parameters<typeof projects.create>[0]> = {}) {
    return projects.create(
      {
        title: 'Ocean Ridge Residences',
        description: 'A waterfront residential development in Lekki.',
        longDescription: 'Forty-eight units across four blocks.',
        status: 'ongoing',
        publishedAt: new Date().toISOString(),
        ...overrides,
      },
      adminId,
    );
  }

  it('creates a project and derives a slug from the title', async () => {
    const project = await seedProject();
    expect(project.slug).toBe('ocean-ridge-residences');
    expect(project.status).toBe('ongoing');
  });

  it('disambiguates a duplicate slug rather than failing', async () => {
    await seedProject();
    const second = await seedProject();
    expect(second.slug).toBe('ocean-ridge-residences-2');
  });

  it('hides unpublished projects from public reads', async () => {
    await seedProject({ publishedAt: null });

    expect(await projects.findBySlug('ocean-ridge-residences')).toBeNull();
    expect(
      await projects.findBySlug('ocean-ridge-residences', { includeUnpublished: true }),
    ).not.toBeNull();

    const page = await projects.listProjects({ page: 1, pageSize: 10 });
    expect(page.pagination.total).toBe(0);
  });

  it('hides a future-dated publication until its time arrives', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    await seedProject({ publishedAt: tomorrow });

    expect(await projects.findBySlug('ocean-ridge-residences')).toBeNull();
  });

  it('excludes soft-deleted projects from every public read', async () => {
    const project = await seedProject();
    await projects.softDelete(project.id);

    expect(await projects.findById(project.id)).toBeNull();
    expect((await projects.listProjects({ page: 1, pageSize: 10 })).pagination.total).toBe(0);

    // The row itself survives, which is the point of a soft delete.
    const row = await queryOne(`SELECT deleted_at FROM projects WHERE id = $1`, [project.id]);
    expect(row).not.toBeNull();
  });

  it('filters by status and paginates', async () => {
    await seedProject({ title: 'Alpha', status: 'ongoing' });
    await seedProject({ title: 'Beta', status: 'completed' });
    await seedProject({ title: 'Gamma', status: 'completed' });

    const completed = await projects.listProjects({ status: 'completed', page: 1, pageSize: 1 });

    expect(completed.pagination.total).toBe(2);
    expect(completed.pagination.totalPages).toBe(2);
    expect(completed.pagination.hasNextPage).toBe(true);
    expect(completed.results).toHaveLength(1);
    expect(completed.results.every((p) => p.status === 'completed')).toBe(true);
  });

  it('searches the generated tsvector across title and body', async () => {
    await seedProject({ title: 'Alpha Tower', description: 'A commercial high-rise.' });
    await seedProject({ title: 'Beta Villas', description: 'Suburban homes.' });

    const hits = await projects.listProjects({ q: 'commercial', page: 1, pageSize: 10 });

    expect(hits.pagination.total).toBe(1);
    expect(hits.results[0]!.title).toBe('Alpha Tower');
  });

  it('filters by taxonomy slug', async () => {
    const sector = await queryOne<{ id: string }>(
      `INSERT INTO sectors (name, slug) VALUES ('Hospitality', 'hospitality') RETURNING id`,
    );
    await seedProject({ title: 'Hotel One', sectorId: sector!.id });
    await seedProject({ title: 'Unrelated' });

    const page = await projects.listProjects({ sector: 'hospitality', page: 1, pageSize: 10 });

    expect(page.pagination.total).toBe(1);
    expect(page.results[0]!.sector_name).toBe('Hospitality');
  });

  describe('investor content approval gate', () => {
    it('withholds investor figures until legal approves them', async () => {
      const project = await seedProject({
        investmentAmount: 1_250_000_000,
        expectedRoi: 18.5,
        investorHighlights: { tenure: 'Freehold' },
      });

      expect(serializeProject(project).investor).toBeNull();

      const approved = await projects.setInvestorApproval(project.id, true, adminId);
      const serialized = serializeProject(approved!);

      expect(serialized.investor).toEqual({
        investmentAmount: 1_250_000_000,
        expectedRoi: 18.5,
        highlights: { tenure: 'Freehold' },
      });
    });

    it('revokes the approval when the investor content is edited', async () => {
      const project = await seedProject({ investorHighlights: { tenure: 'Freehold' } });
      await projects.setInvestorApproval(project.id, true, adminId);

      const edited = await projects.update(project.id, {
        investorHighlights: { tenure: 'Leasehold' },
      });

      expect(edited!.investor_highlights_approved).toBe(false);
      expect(serializeProject(edited!).investor).toBeNull();
    });

    it('leaves the approval alone when unrelated fields change', async () => {
      const project = await seedProject({ investorHighlights: { tenure: 'Freehold' } });
      await projects.setInvestorApproval(project.id, true, adminId);

      const edited = await projects.update(project.id, { title: 'Renamed' });

      expect(edited!.investor_highlights_approved).toBe(true);
    });
  });

  it('reports facet counts over live projects only', async () => {
    await seedProject({ title: 'Live One', status: 'ongoing' });
    await seedProject({ title: 'Draft One', status: 'ongoing', publishedAt: null });

    const facets = await projects.facets();
    const ongoing = facets.statuses.find((s) => s.value === 'ongoing');

    expect(ongoing?.count).toBe(1);
  });

  it('computes passport progress from public milestones', async () => {
    const project = await seedProject();

    await query(
      `INSERT INTO passport_milestones (project_id, milestone_type, status, actual_date, sort_order)
       VALUES ($1, 'commencement', 'completed', '2025-02-10', 0),
              ($1, 'foundation',   'completed', '2025-05-22', 1),
              ($1, 'roofing',      'pending',   NULL,         2)`,
      [project.id],
    );

    const progress = await passport.progressForProject(project.id);

    expect(progress).toMatchObject({ total: 3, completed: 2, percentComplete: 67 });
    expect(progress.nextMilestone?.type).toBe('roofing');
  });

  it('refuses a completed milestone with no actual date', async () => {
    const project = await seedProject();

    await expect(
      query(
        `INSERT INTO passport_milestones (project_id, milestone_type, status)
         VALUES ($1, 'handover', 'completed')`,
        [project.id],
      ),
    ).rejects.toThrow(/passport_completed_has_date/);
  });

  it('withholds internal milestones from the public timeline', async () => {
    const project = await seedProject();

    await query(
      `INSERT INTO passport_milestones (project_id, milestone_type, status, is_public)
       VALUES ($1, 'mep', 'in_progress', TRUE), ($1, 'custom', 'pending', FALSE)`,
      [project.id],
    );

    expect(await passport.listForProject(project.id)).toHaveLength(1);
    expect(
      await passport.listForProject(project.id, { includeInternal: true }),
    ).toHaveLength(2);
  });
});
