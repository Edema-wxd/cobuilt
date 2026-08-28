import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { pool, query, queryOne } from '@/lib/db';
import * as news from '@/lib/repositories/news';
import * as forms from '@/lib/repositories/forms';
import * as newsletter from '@/lib/repositories/newsletter';
import * as audit from '@/lib/repositories/audit';
import * as analytics from '@/lib/repositories/analytics';
import * as pgSearch from '@/lib/search/postgres';
import { applyWebhook } from '@/lib/cms/sync';

describeWithDatabase('content, forms and sync', () => {
  let authorId: string;

  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    const user = await queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ('editor@test.local', 'x', 'Test Editor', 'editor') RETURNING id`,
    );
    authorId = user!.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('news', () => {
    const article = (overrides: Record<string, unknown> = {}) => ({
      title: 'CoBuilt breaks ground on Ocean Ridge',
      content: 'Construction has commenced on the Lekki waterfront development.',
      excerpt: 'Construction has commenced.',
      category: 'press_release',
      tags: ['construction', 'lekki'],
      publishedAt: new Date().toISOString(),
      ...overrides,
    });

    it('creates an article with a derived slug', async () => {
      const created = await news.create(article(), authorId);
      expect(created.slug).toBe('cobuilt-breaks-ground-on-ocean-ridge');
      expect(created.author_name).toBe('Test Editor');
    });

    it('filters by tag using array containment', async () => {
      await news.create(article(), authorId);
      await news.create(
        article({ title: 'Unrelated update', tags: ['company'] }),
        authorId,
      );

      const page = await news.list({ tag: 'lekki', page: 1, pageSize: 10 });
      expect(page.pagination.total).toBe(1);
    });

    it('ranks related articles by shared tags ahead of category alone', async () => {
      const source = await news.create(article(), authorId);
      await news.create(
        article({ title: 'Two shared tags', tags: ['construction', 'lekki'] }),
        authorId,
      );
      await news.create(
        article({ title: 'Category only', tags: ['unrelated'] }),
        authorId,
      );

      const related = await news.related(source.id, 5);

      expect(related).toHaveLength(2);
      expect(related[0]!.title).toBe('Two shared tags');
    });

    it('keeps soft-deleted articles out of listings', async () => {
      const created = await news.create(article(), authorId);
      await news.softDelete(created.id);

      expect(await news.findBySlug(created.slug)).toBeNull();
      expect((await news.list({ page: 1, pageSize: 10 })).pagination.total).toBe(0);
    });
  });

  describe('form submissions and NDPA retention', () => {
    it('sets a 90-day retention deadline on an enquiry', async () => {
      const submission = await forms.create({
        formType: 'inquiry',
        name: 'Adaeze Okafor',
        email: 'adaeze@example.com',
        message: 'Please send details.',
      });

      const days = (new Date(submission.retain_until).getTime() - Date.now()) / 86_400_000;
      expect(Math.round(days)).toBe(90);
    });

    it('sets a two-year deadline on an investor enquiry', async () => {
      const submission = await forms.create({
        formType: 'investment',
        email: 'investor@example.com',
        message: 'Interested in the fund.',
      });

      const days = (new Date(submission.retain_until).getTime() - Date.now()) / 86_400_000;
      expect(Math.round(days)).toBe(730);
    });

    it('anonymises expired submissions but keeps the row for counting', async () => {
      const submission = await forms.create({
        formType: 'inquiry',
        name: 'Adaeze Okafor',
        email: 'adaeze@example.com',
        phone: '+2348012345678',
        message: 'Please send details.',
        ipAddress: '102.89.44.0',
      });

      await query(
        `UPDATE form_submissions SET retain_until = NOW() - INTERVAL '1 day' WHERE id = $1`,
        [submission.id],
      );

      expect(await forms.purgeExpired()).toBe(1);

      const after = await forms.findById(submission.id);
      expect(after).not.toBeNull();
      expect(after!.email).toBeNull();
      expect(after!.name).toBeNull();
      expect(after!.message).toBeNull();
      expect(after!.anonymised_at).not.toBeNull();
    });

    it('leaves submissions inside their retention window untouched', async () => {
      await forms.create({ formType: 'inquiry', email: 'keep@example.com', message: 'Hello.' });
      expect(await forms.purgeExpired()).toBe(0);
    });

    it('anonymises a single subject on an erasure request', async () => {
      await forms.create({ formType: 'inquiry', email: 'erase@example.com', message: 'One.' });
      await forms.create({ formType: 'inquiry', email: 'keep@example.com', message: 'Two.' });

      expect(await forms.anonymiseByEmail('ERASE@example.com')).toBe(1);

      const remaining = await forms.list({ page: 1, pageSize: 10 });
      expect(remaining.results.filter((r) => r.email === 'keep@example.com')).toHaveLength(1);
    });

    it('rejects a spam score outside the column range', async () => {
      await expect(
        query(
          `INSERT INTO form_submissions (form_type, spam_score, retain_until)
           VALUES ('inquiry', 1.5, NOW() + INTERVAL '90 days')`,
        ),
      ).rejects.toThrow(/spam_score_range/);
    });
  });

  describe('newsletter double opt-in', () => {
    it('requires confirmation before a subscriber counts as active', async () => {
      const outcome = await newsletter.subscribe({ email: 'reader@example.com' });
      expect(outcome.status).toBe('pending_confirmation');
      expect(await newsletter.countActive()).toBe(0);

      if (outcome.status !== 'pending_confirmation') throw new Error('unreachable');
      const confirmed = await newsletter.confirm(outcome.confirmationToken);

      expect(confirmed).not.toBeNull();
      expect(await newsletter.countActive()).toBe(1);
    });

    it('rejects a reused confirmation token', async () => {
      const outcome = await newsletter.subscribe({ email: 'reader@example.com' });
      if (outcome.status !== 'pending_confirmation') throw new Error('unreachable');

      await newsletter.confirm(outcome.confirmationToken);
      expect(await newsletter.confirm(outcome.confirmationToken)).toBeNull();
    });

    it('reports a second signup for a confirmed address as already subscribed', async () => {
      const first = await newsletter.subscribe({ email: 'reader@example.com' });
      if (first.status !== 'pending_confirmation') throw new Error('unreachable');
      await newsletter.confirm(first.confirmationToken);

      expect((await newsletter.subscribe({ email: 'reader@example.com' })).status).toBe(
        'already_subscribed',
      );
    });

    it('lets an unsubscribed address resubscribe', async () => {
      const first = await newsletter.subscribe({ email: 'reader@example.com' });
      if (first.status !== 'pending_confirmation') throw new Error('unreachable');
      await newsletter.confirm(first.confirmationToken);

      await newsletter.unsubscribe(first.subscriber.unsubscribe_token);
      expect(await newsletter.countActive()).toBe(0);

      expect((await newsletter.subscribe({ email: 'reader@example.com' })).status).toBe(
        'pending_confirmation',
      );
    });
  });

  describe('CMS sync', () => {
    const payload = (overrides: Record<string, unknown> = {}) => ({
      event: 'entry.publish' as const,
      model: 'project',
      entry: {
        id: 42,
        title: 'CMS Authored Project',
        description: 'Published from Strapi.',
        status: 'ongoing',
        publishedAt: new Date().toISOString(),
        ...overrides,
      },
    });

    it('upserts a project from a publish webhook', async () => {
      const result = await applyWebhook(payload(), 'delivery-1');

      expect(result.status).toBe('applied');
      expect(result.revalidate).toContain('/projects');

      const row = await queryOne<{ title: string; cms_id: string }>(
        `SELECT title, cms_id FROM projects WHERE cms_id = '42'`,
      );
      expect(row?.title).toBe('CMS Authored Project');
    });

    it('updates rather than duplicating on a redelivered webhook', async () => {
      await applyWebhook(payload(), 'delivery-1');
      await applyWebhook(payload({ title: 'Renamed In CMS' }), 'delivery-2');

      const { rows } = await query<{ title: string }>(
        `SELECT title FROM projects WHERE cms_id = '42'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.title).toBe('Renamed In CMS');
    });

    it('takes content off the site on unpublish', async () => {
      await applyWebhook(payload(), 'delivery-1');
      await applyWebhook(
        { ...payload(), event: 'entry.unpublish' },
        'delivery-2',
      );

      const row = await queryOne<{ published_at: Date | null }>(
        `SELECT published_at FROM projects WHERE cms_id = '42'`,
      );
      expect(row?.published_at).toBeNull();
    });

    it('soft-deletes on a delete webhook', async () => {
      await applyWebhook(payload(), 'delivery-1');
      await applyWebhook({ ...payload(), event: 'entry.delete' }, 'delivery-2');

      const row = await queryOne<{ deleted_at: Date | null }>(
        `SELECT deleted_at FROM projects WHERE cms_id = '42'`,
      );
      expect(row?.deleted_at).not.toBeNull();
    });

    it('skips a model that is not synced, and records why', async () => {
      const result = await applyWebhook(
        { event: 'entry.publish', model: 'unknown-model', entry: { id: 1 } },
        'delivery-9',
      );

      expect(result.status).toBe('skipped');

      const log = await queryOne<{ status: string; error: string }>(
        `SELECT status, error FROM cms_sync_log WHERE delivery_id = 'delivery-9'`,
      );
      expect(log?.status).toBe('skipped');
      expect(log?.error).toContain('unknown-model');
    });

    it('reads Strapi v4 payloads that nest fields under attributes', async () => {
      const result = await applyWebhook(
        {
          event: 'entry.publish',
          model: 'news-article',
          entry: {
            id: 7,
            attributes: {
              title: 'Nested Attributes Article',
              content: 'Body text.',
              publishedAt: new Date().toISOString(),
            },
          },
        },
        'delivery-v4',
      );

      expect(result.status).toBe('applied');
      const row = await queryOne<{ title: string }>(
        `SELECT title FROM news_articles WHERE cms_id = '7'`,
      );
      expect(row?.title).toBe('Nested Attributes Article');
    });
  });

  describe('PostgreSQL search fallback', () => {
    beforeEach(async () => {
      await query(
        `INSERT INTO projects (title, slug, description, status, published_at)
         VALUES ('Waterfront Commercial Tower', 'waterfront-tower',
                 'A commercial high-rise on the marina.', 'ongoing', NOW())`,
      );
      await query(
        `INSERT INTO news_articles (title, slug, content, excerpt, published_at)
         VALUES ('Marina district update', 'marina-update',
                 'Progress on the commercial marina district.', 'Progress.', NOW())`,
      );
      await query(
        `INSERT INTO faqs (question, answer) VALUES
           ('What is the Project Passport?', 'A published record of construction milestones.')`,
      );
    });

    it('finds projects by full-text match', async () => {
      const hits = await pgSearch.searchProjects({ q: 'commercial', limit: 10, offset: 0 });
      expect(hits).toHaveLength(1);
      expect(hits[0]!.url).toBe('/projects/waterfront-tower');
    });

    it('finds news and FAQs by full-text match', async () => {
      expect(await pgSearch.searchNews({ q: 'marina', limit: 10, offset: 0 })).toHaveLength(1);
      expect(await pgSearch.searchFaqs({ q: 'passport', limit: 10, offset: 0 })).toHaveLength(1);
    });

    it('handles quoted phrases and exclusions without a syntax error', async () => {
      await expect(
        pgSearch.searchProjects({ q: '"commercial tower" -residential', limit: 10, offset: 0 }),
      ).resolves.toBeDefined();
    });

    it('does not throw on input that would break to_tsquery', async () => {
      await expect(
        pgSearch.searchProjects({ q: 'a & | ! ( ) :*', limit: 10, offset: 0 }),
      ).resolves.toBeDefined();
    });

    it('suggests by trigram similarity on a partial word', async () => {
      const hits = await pgSearch.autocomplete('waterfr', 5);
      expect(hits.some((h) => h.title === 'Waterfront Commercial Tower')).toBe(true);
    });

    it('counts matches for pagination', async () => {
      expect(await pgSearch.countMatches('projects', 'commercial')).toBe(1);
      expect(await pgSearch.countMatches('projects', undefined)).toBe(1);
    });
  });

  describe('audit trail and analytics', () => {
    it('records and filters audit entries', async () => {
      await audit.record({
        actorId: authorId,
        actorEmail: 'editor@test.local',
        action: 'project.deleted',
        entityType: 'project',
        entityId: '00000000-0000-4000-8000-000000000001',
        changes: { softDelete: true },
        ipAddress: '102.89.44.0',
      });

      const page = await audit.list({ page: 1, pageSize: 10, action: 'project.deleted' });

      expect(page.pagination.total).toBe(1);
      expect(page.results[0]!.changes).toEqual({ softDelete: true });
    });

    it('never fails the caller when the audit write fails', async () => {
      await expect(
        audit.record({
          actorId: authorId,
          actorEmail: 'editor@test.local',
          action: 'x'.repeat(500), // Exceeds the column length
          entityType: 'project',
        }),
      ).resolves.toBeUndefined();
    });

    it('truncates the visitor IP before storing a page view', async () => {
      await analytics.recordPageView({
        pagePath: '/projects/waterfront-tower',
        ipAddress: '102.89.44.187',
        sessionId: 'session-1',
      });

      const row = await queryOne<{ ip: string }>(
        `SELECT host(ip_address) AS ip FROM page_views LIMIT 1`,
      );
      expect(row?.ip).toBe('102.89.44.0');
    });

    it('summarises traffic for the dashboard', async () => {
      await analytics.recordPageView({ pagePath: '/projects', sessionId: 's1' });
      await analytics.recordPageView({ pagePath: '/projects', sessionId: 's2' });
      await analytics.recordPageView({ pagePath: '/news', sessionId: 's1' });

      const summary = await analytics.summary(30);

      expect(summary.totalViews).toBe(3);
      expect(summary.uniqueSessions).toBe(2);
      expect(summary.topPages[0]).toEqual({ path: '/projects', views: 2 });
    });

    it('deletes page views past the retention window', async () => {
      await analytics.recordPageView({ pagePath: '/projects', sessionId: 's1' });
      await query(`UPDATE page_views SET viewed_at = NOW() - INTERVAL '45 days'`);

      expect(await analytics.purgeExpiredPageViews()).toBe(1);
    });
  });
});
