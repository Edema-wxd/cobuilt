import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { bearerFor, callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import * as cache from '@/lib/cache';
import * as rateLimit from '@/lib/rateLimit';
import * as storage from '@/lib/storage/uploadthing';
import * as documents from '@/lib/repositories/documents';
import { createDocumentBody, fileTypeFromUrl, updateDocumentBody } from '@/lib/schemas/documents';
import publicList from '../../pages/api/documents/index';
import download from '../../pages/api/documents/[id]/download';
import adminList from '../../pages/api/admin/documents/index';
import adminItem from '../../pages/api/admin/documents/[documentId]';
import adminReorder from '../../pages/api/admin/documents/reorder';
import { loadResources } from '../../app/resources/load-resources';
import { loadProject } from '../../app/projects/[slug]/load-project';

/**
 * The download centre (docs/decisions.md §2.25): the repository, the public
 * list and the counted download endpoint, the admin API and its permissions,
 * and the pages' loaders. Storage is mocked — there is no UploadThing token
 * here — but the upload route's own authorisation runs for real.
 */

jest.mock('@/lib/storage/uploadthing', () => ({
  ...jest.requireActual('@/lib/storage/uploadthing'),
  isStorageConfigured: jest.fn(() => true),
  lookupFile: jest.fn(),
  deleteFile: jest.fn(() => Promise.resolve()),
}));

const storageMock = jest.mocked(storage);

/** The account the test bearer tokens carry (setup/helpers.ts), so audit rows can reference it. */
const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const MISSING = '00000000-0000-4000-8000-00000000dead';

describeWithDatabase('documents', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  beforeEach(async () => {
    await truncateAll();
    jest.clearAllMocks();
    await query(
      `INSERT INTO users (id, email, full_name, role) VALUES ($1, 'editor@cobuilt.test', 'Test Editor', 'editor')`,
      [ACTOR_ID],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  async function project(slug: string, publishedAt: string | null = new Date().toISOString()) {
    return (await queryOne<{ id: string }>(
      `INSERT INTO projects (title, slug, status, published_at) VALUES ($1, $2, 'completed', $3) RETURNING id`,
      [slug.replace(/-/g, ' '), slug, publishedAt],
    ))!.id;
  }

  /** A linked document straight through the repository. */
  function make(overrides: Partial<documents.CreateDocumentInput> = {}) {
    return documents.create({
      title: 'Company profile',
      description: null,
      category: 'company_profile',
      projectId: null,
      published: true,
      createdBy: null,
      fileUrl: 'https://files.cobuilt.test/company-profile.pdf',
      fileKey: null,
      fileType: 'pdf',
      fileSizeBytes: null,
      ...overrides,
    });
  }

  describe('schemas', () => {
    it('reads the file type from a link’s extension', () => {
      expect(fileTypeFromUrl('https://x.test/a/Profile.PDF?v=2')).toBe('pdf');
      expect(fileTypeFromUrl('https://x.test/brochure.docx#page=2')).toBe('docx');
      expect(fileTypeFromUrl('https://drive.example.com/file/d/abc/view')).toBeNull();
    });

    it('takes an upload or a link, exactly one, and only an https link', () => {
      const base = { title: 'Profile', category: 'brochure' };
      expect(createDocumentBody.safeParse(base).success).toBe(false);
      expect(createDocumentBody.safeParse({ ...base, fileKey: 'k', fileUrl: 'https://x.test/a.pdf' }).success).toBe(false);
      expect(createDocumentBody.safeParse({ ...base, fileUrl: 'http://x.test/a.pdf' }).success).toBe(false);
      expect(createDocumentBody.safeParse({ ...base, fileUrl: 'javascript:alert(1)' }).success).toBe(false);
      expect(createDocumentBody.parse({ ...base, fileKey: 'k' })).toMatchObject({ published: false, projectId: null });
      expect(updateDocumentBody.safeParse({}).success).toBe(false);
      expect(updateDocumentBody.safeParse({ category: 'leaflet' }).success).toBe(false);
    });

    it('refuses a link that is not https at the database too', async () => {
      await expect(make({ fileUrl: 'http://files.cobuilt.test/a.pdf' })).rejects.toThrow(/documents_file_url_https/);
    });
  });

  describe('repository', () => {
    it('creates at the end of the list with a unique slug from the title', async () => {
      const first = await make();
      const second = await make();
      expect(second.slug).toBe('company-profile-2');
      expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
      expect(second).toMatchObject({ downloadCount: 0, downloadUrl: `/api/documents/${second.id}/download` });
    });

    it('lists only published documents, and none attached to a project that is not live', async () => {
      const live = await project('ocean-ridge');
      const draft = await project('northgate', null);
      const deleted = await project('old-scheme');
      await query(`UPDATE projects SET deleted_at = NOW() WHERE id = $1`, [deleted]);

      await make({ title: 'Published' });
      await make({ title: 'Draft', published: false });
      await make({ title: 'Ocean Ridge profile', category: 'project_profile', projectId: live });
      await make({ title: 'Northgate profile', category: 'project_profile', projectId: draft });
      await make({ title: 'Old scheme profile', category: 'project_profile', projectId: deleted });

      expect((await documents.listPublished()).map((d) => d.title)).toEqual(['Published', 'Ocean Ridge profile']);
      expect((await documents.listPublished({ category: 'project_profile' })).map((d) => d.title)).toEqual([
        'Ocean Ridge profile',
      ]);
      const [profile] = await documents.listPublished({ projectId: live });
      expect(profile).toMatchObject({ project: { id: live, slug: 'ocean-ridge' } });
      // The public shape carries neither the file's own URL nor its storage key nor its count.
      expect(profile).not.toHaveProperty('fileUrl');
      expect(profile).not.toHaveProperty('fileKey');
      expect(profile).not.toHaveProperty('downloadCount');
      // The console sees every row, with the project's state.
      expect((await documents.listAll()).find((d) => d.title === 'Northgate profile')?.project?.isPublished).toBe(false);
    });

    it('counts a download without moving "last edited", and keeps a daily count', async () => {
      const document = await make();

      await documents.recordDownload(document.id);
      await documents.recordDownload(document.id);

      // Each write is its own transaction, so had the trigger run, NOW() would have moved it.
      const after = await documents.findById(document.id);
      expect(after).toMatchObject({ downloadCount: 2, updatedAt: document.updatedAt });
      expect((await documents.listAll())[0]!.downloadsLast30Days).toBe(2);
      const days = await query<{ downloads: number }>(`SELECT downloads FROM document_download_days`);
      expect(days.rows).toEqual([{ downloads: 2 }]);

      // An edit does move it.
      await documents.update(document.id, { title: 'Company profile 2026' });
      expect((await documents.findById(document.id))!.updatedAt).not.toBe(document.updatedAt);
    });

    it('stores nothing about who downloaded', async () => {
      const columns = await query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE table_name IN ('documents', 'document_download_days')`,
      );
      const names = columns.rows.map((row) => row.column_name);
      for (const personal of ['ip_address', 'user_agent', 'visitor_id', 'session_id', 'email']) {
        expect(names).not.toContain(personal);
      }
    });

    it('reorders only when given every document exactly once', async () => {
      const a = await make({ title: 'Alpha' });
      const b = await make({ title: 'Beta' });
      const c = await make({ title: 'Gamma' });

      expect(await documents.reorder([c.id, a.id])).toBe(false);
      expect(await documents.reorder([c.id, a.id, b.id])).toBe(true);
      expect((await documents.listAll()).map((d) => d.title)).toEqual(['Gamma', 'Alpha', 'Beta']);
    });
  });

  describe('GET /api/documents', () => {
    it('lists published documents, cacheable, filtered by category and by project id or slug', async () => {
      const live = await project('ocean-ridge');
      const draft = await project('northgate', null);
      await make({ title: 'Company profile' });
      await make({ title: 'Brochure', category: 'brochure' });
      await make({ title: 'Ocean Ridge profile', category: 'project_profile', projectId: live });
      await make({ title: 'Hidden', published: false });

      const all = await callRoute(publicList);
      expect(all.status).toBe(200);
      expect(all.headers['cache-control']).toMatch(/s-maxage=60/);
      expect(all.body.results.map((d: { title: string }) => d.title)).toEqual([
        'Company profile',
        'Brochure',
        'Ocean Ridge profile',
      ]);

      const brochures = await callRoute(publicList, { query: { category: 'brochure' } });
      expect(brochures.body.results.map((d: { title: string }) => d.title)).toEqual(['Brochure']);

      for (const ref of [live, 'ocean-ridge']) {
        const byProject = await callRoute(publicList, { query: { project: ref } });
        expect(byProject.body.results.map((d: { title: string }) => d.title)).toEqual(['Ocean Ridge profile']);
      }
      // An unpublished or unknown project is an empty list, not an error.
      expect((await callRoute(publicList, { query: { project: draft } })).body.results).toEqual([]);
      expect((await callRoute(publicList, { query: { project: 'nowhere' } })).body.results).toEqual([]);
      expect((await callRoute(publicList, { query: { category: 'leaflet' } })).status).toBe(422);
    });
  });

  describe('GET /api/documents/[id]/download', () => {
    const get = (id: string, userAgent: string | null = BROWSER) =>
      callRoute(download, { query: { id }, headers: userAgent ? { 'user-agent': userAgent } : {} });

    it('counts the download and redirects to the file, uncached', async () => {
      const document = await make();

      const response = await get(document.id);
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('https://files.cobuilt.test/company-profile.pdf');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-robots-tag']).toMatch(/noindex/);

      await get(document.id);
      expect((await documents.findById(document.id))!.downloadCount).toBe(2);
    });

    it('redirects a self-declared crawler without counting it', async () => {
      const document = await make();
      expect((await get(document.id, 'Googlebot/2.1 (+http://www.google.com/bot.html)')).status).toBe(302);
      expect((await get(document.id, null)).status).toBe(302);
      expect((await documents.findById(document.id))!.downloadCount).toBe(0);
    });

    it('is a 404 for a draft, a document on an unpublished project, or none at all', async () => {
      const draft = await make({ published: false });
      const onDraftProject = await make({ projectId: await project('northgate', null) });

      for (const id of [draft.id, onDraftProject.id, MISSING]) {
        expect((await get(id)).status).toBe(404);
      }
      expect((await get('not-a-uuid')).status).toBe(422);
      expect((await documents.findById(draft.id))!.downloadCount).toBe(0);
    });

    it('is rate limited on its own bucket, and counts nothing once limited', async () => {
      const document = await make();
      const consume = jest
        .spyOn(rateLimit, 'consume')
        .mockResolvedValue({ allowed: false, limit: 30, remaining: 0, resetSeconds: 120 });

      try {
        const response = await get(document.id);
        expect(response.status).toBe(429);
        expect(response.headers['retry-after']).toBe('120');
        expect(consume).toHaveBeenCalledWith(rateLimit.RATE_LIMITS.download, expect.any(String));
      } finally {
        consume.mockRestore();
      }
      expect((await documents.findById(document.id))!.downloadCount).toBe(0);
    });
  });

  describe('admin API', () => {
    const as = (role: 'admin' | 'editor' | 'viewer' | 'investor') => ({
      authorization: `Bearer ${bearerFor({ userId: ACTOR_ID, role })}`,
    });

    const linkBody = {
      title: 'Capability statement',
      category: 'capability_statement',
      fileUrl: 'https://files.cobuilt.test/capability.pdf',
      published: true,
    };

    it('refuses anyone without downloads:write', async () => {
      const document = await make();
      for (const role of ['viewer', 'investor'] as const) {
        expect((await callRoute(adminList, { headers: as(role) })).status).toBe(403);
        expect((await callRoute(adminList, { method: 'POST', headers: as(role), body: linkBody })).status).toBe(403);
        expect(
          (await callRoute(adminItem, { method: 'PATCH', headers: as(role), query: { documentId: document.id }, body: { title: 'X' } }))
            .status,
        ).toBe(403);
        expect((await callRoute(adminReorder, { method: 'POST', headers: as(role), body: { ids: [document.id] } })).status).toBe(403);
      }
      expect((await callRoute(adminList)).status).toBe(401);
    });

    it('lets an editor add a linked document, audited, clearing the cache', async () => {
      const invalidate = jest.spyOn(cache, 'invalidatePrefix');
      const response = await callRoute(adminList, { method: 'POST', headers: as('editor'), body: linkBody });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'Capability statement',
        slug: 'capability-statement',
        fileType: 'pdf',
        fileSizeBytes: null,
        fileKey: null,
        published: true,
      });
      expect(invalidate).toHaveBeenCalledWith('documents');
      invalidate.mockRestore();

      const entry = await queryOne<{ action: string; entity_id: string; changes: Record<string, unknown> }>(
        `SELECT action, entity_id, changes FROM audit_log WHERE action = 'document.created'`,
      );
      expect(entry).toMatchObject({ entity_id: response.body.id, changes: { source: 'link', category: 'capability_statement' } });

      const list = await callRoute(adminList, { headers: as('editor') });
      expect(list.body.results.map((d: { title: string }) => d.title)).toEqual(['Capability statement']);
    });

    it('registers an upload only once storage confirms it, with the size storage reports', async () => {
      storageMock.lookupFile.mockResolvedValueOnce({ exists: false, sizeBytes: 0, url: null });
      const missing = await callRoute(adminList, {
        method: 'POST',
        headers: as('editor'),
        body: { title: 'Brochure', category: 'brochure', fileKey: 'key-1' },
      });
      expect(missing.status).toBe(400);

      storageMock.lookupFile.mockResolvedValueOnce({ exists: true, sizeBytes: 2_516_582, url: 'https://utfs.io/f/key-1' });
      const created = await callRoute(adminList, {
        method: 'POST',
        headers: as('editor'),
        body: { title: 'Brochure', category: 'brochure', fileKey: 'key-1' },
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        fileKey: 'key-1',
        fileUrl: 'https://utfs.io/f/key-1',
        fileType: 'pdf',
        fileSizeBytes: 2_516_582,
        published: false,
      });

      storageMock.isStorageConfigured.mockReturnValueOnce(false);
      const unconfigured = await callRoute(adminList, {
        method: 'POST',
        headers: as('editor'),
        body: { title: 'Brochure', category: 'brochure', fileKey: 'key-2' },
      });
      expect(unconfigured.status).toBe(503);
    });

    it('refuses an unknown project', async () => {
      const response = await callRoute(adminList, {
        method: 'POST',
        headers: as('editor'),
        body: { ...linkBody, projectId: MISSING },
      });
      expect(response.status).toBe(422);
      expect(response.body.error.details[0].field).toBe('projectId');
    });

    it('replaces an uploaded file with a link and deletes the stored upload', async () => {
      const document = await make({ fileKey: 'old-key', fileUrl: 'https://utfs.io/f/old-key', fileSizeBytes: 1000 });

      const response = await callRoute(adminItem, {
        method: 'PATCH',
        headers: as('editor'),
        query: { documentId: document.id },
        body: { fileUrl: 'https://files.cobuilt.test/new.docx', published: false },
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        fileKey: null,
        fileUrl: 'https://files.cobuilt.test/new.docx',
        fileType: 'docx',
        fileSizeBytes: null,
        published: false,
      });
      expect(storageMock.deleteFile).toHaveBeenCalledWith('old-key');

      const entry = await queryOne<{ changes: Record<string, unknown> }>(
        `SELECT changes FROM audit_log WHERE action = 'document.updated'`,
      );
      expect(entry!.changes).toMatchObject({ published: false, fileReplaced: true, source: 'link' });
    });

    it('leaves the file alone on an edit that does not touch it', async () => {
      const document = await make({ fileKey: 'kept', fileUrl: 'https://utfs.io/f/kept' });
      const response = await callRoute(adminItem, {
        method: 'PATCH',
        headers: as('editor'),
        query: { documentId: document.id },
        body: { title: 'Company profile 2026', description: 'Who we are.' },
      });
      expect(response.body).toMatchObject({ title: 'Company profile 2026', fileKey: 'kept' });
      expect(storageMock.deleteFile).not.toHaveBeenCalled();
    });

    it('lets only an admin delete, and deletes the uploaded file with it', async () => {
      const document = await make({ fileKey: 'stored', fileUrl: 'https://utfs.io/f/stored' });

      const refused = await callRoute(adminItem, { method: 'DELETE', headers: as('editor'), query: { documentId: document.id } });
      expect(refused.status).toBe(403);

      const removed = await callRoute(adminItem, { method: 'DELETE', headers: as('admin'), query: { documentId: document.id } });
      expect(removed.status).toBe(204);
      expect(storageMock.deleteFile).toHaveBeenCalledWith('stored');
      expect(await documents.findById(document.id)).toBeNull();
      expect(
        (await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'document.deleted'`))!.n,
      ).toBe(1);

      const again = await callRoute(adminItem, { method: 'DELETE', headers: as('admin'), query: { documentId: document.id } });
      expect(again.status).toBe(404);
    });

    it('deletes a linked document without touching storage', async () => {
      const document = await make();
      await callRoute(adminItem, { method: 'DELETE', headers: as('admin'), query: { documentId: document.id } });
      expect(storageMock.deleteFile).not.toHaveBeenCalled();
    });

    it('reorders the whole list, and refuses a stale one', async () => {
      const a = await make({ title: 'Alpha' });
      const b = await make({ title: 'Beta' });

      const stale = await callRoute(adminReorder, { method: 'POST', headers: as('editor'), body: { ids: [b.id] } });
      expect(stale.status).toBe(422);

      const response = await callRoute(adminReorder, { method: 'POST', headers: as('editor'), body: { ids: [b.id, a.id] } });
      expect(response.status).toBe(200);
      expect(response.body.results.map((d: { title: string }) => d.title)).toEqual(['Beta', 'Alpha']);
      expect(
        (await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM audit_log WHERE action = 'document.reordered'`))!.n,
      ).toBe(1);
    });
  });

  describe('the upload route', () => {
    const pdf = { name: 'Company Profile.PDF', size: 2_000_000 };
    const token = (role: 'admin' | 'editor' | 'viewer') => `Bearer ${bearerFor({ role })}`;

    it('lets an admin or editor upload one PDF', async () => {
      await expect(storage.authoriseDocumentUpload(token('editor'), [pdf])).resolves.toEqual({ userId: ACTOR_ID });
      await expect(storage.authoriseDocumentUpload(token('admin'), [pdf])).resolves.toEqual({ userId: ACTOR_ID });
    });

    it('refuses anyone else, anything but a PDF, and anything over the limit', async () => {
      await expect(storage.authoriseDocumentUpload(undefined, [pdf])).rejects.toThrow('Sign in to upload.');
      await expect(storage.authoriseDocumentUpload('Bearer nonsense', [pdf])).rejects.toThrow(/session has expired/);
      await expect(storage.authoriseDocumentUpload(token('viewer'), [pdf])).rejects.toThrow(/role does not allow/);
      await expect(storage.authoriseDocumentUpload(token('editor'), [{ name: 'plan.docx', size: 10 }])).rejects.toThrow(
        'The document must be a PDF.',
      );
      await expect(
        storage.authoriseDocumentUpload(token('editor'), [{ name: 'huge.pdf', size: storage.MAX_DOCUMENT_UPLOAD_BYTES + 1 }]),
      ).rejects.toThrow(/32 MB limit/);
    });
  });

  describe('pages', () => {
    it('gives /resources the published documents', async () => {
      await make({ title: 'Company profile' });
      await make({ title: 'Draft', published: false });
      const data = await loadResources();
      expect(data.available).toBe(true);
      expect(data.documents.map((d) => d.title)).toEqual(['Company profile']);
    });

    it('lists a project’s published documents on its page, with the counted link', async () => {
      const live = await project('ocean-ridge');
      const profile = await make({ title: 'Ocean Ridge profile', category: 'project_profile', projectId: live, fileSizeBytes: 840_000 });
      await make({ title: 'Unpublished', projectId: live, published: false });
      await make({ title: 'Elsewhere' });

      const result = await loadProject('ocean-ridge');
      if (result.kind !== 'found') throw new Error(`expected the project, got ${result.kind}`);
      expect(result.props.documents).toEqual([
        {
          id: profile.id,
          title: 'Ocean Ridge profile',
          fileType: 'pdf',
          fileSizeBytes: 840_000,
          downloadUrl: `/api/documents/${profile.id}/download`,
        },
      ]);
    });
  });
});
