import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query, queryOne } from '@/lib/db';
import { loadHomeProjects } from '../../app/home-projects';

describeWithDatabase('landing page projects', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function project(slug: string, publishedAt: string | null, passport = false) {
    return (await queryOne<{ id: string }>(
      `INSERT INTO projects (title, slug, status, published_at, passport_enabled)
       VALUES ($1, $2, 'ongoing', $3, $4) RETURNING id`,
      [slug.replace(/-/g, ' '), slug, publishedAt, passport],
    ))!.id;
  }

  it('shows published projects only, newest first', async () => {
    await project('older-live', new Date(Date.now() - 86_400_000).toISOString());
    await project('newer-live', new Date(Date.now() - 60_000).toISOString());
    await project('draft', null);
    await project('scheduled', new Date(Date.now() + 86_400_000).toISOString());

    const projects = await loadHomeProjects();

    expect(projects.map((p) => p.slug)).toEqual(['newer-live', 'older-live']);
  });

  it('carries Passport progress and the next stage', async () => {
    const id = await project('with-passport', new Date().toISOString(), true);
    await query(
      `INSERT INTO passport_milestones (project_id, milestone_type, status, actual_date, sort_order, is_public)
       VALUES ($1, 'foundation', 'completed', CURRENT_DATE, 1, TRUE),
              ($1, 'superstructure', 'in_progress', NULL, 2, TRUE)`,
      [id],
    );

    const [loaded] = await loadHomeProjects();

    expect(loaded).toMatchObject({
      slug: 'with-passport',
      passport: true,
      progress: { percent: 50, stage: 'Superstructure' },
    });
  });

  it('returns no projects, rather than failing, when the query fails', async () => {
    await project('live', new Date().toISOString());
    await query('ALTER TABLE projects RENAME TO projects_unavailable');
    try {
      expect(await loadHomeProjects()).toEqual([]);
    } finally {
      await query('ALTER TABLE projects_unavailable RENAME TO projects');
    }
  });
});
