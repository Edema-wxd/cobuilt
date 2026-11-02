import { describeWithDatabase, resetDatabase, truncateAll } from '../setup/database';
import { callRoute } from '../setup/helpers';
import { pool, query, queryOne } from '@/lib/db';
import * as gallery from '@/lib/repositories/gallery';
import { galleryForProject } from '@/lib/repositories/projects';
import * as storage from '@/lib/storage/uploadthing';
import { createAlbumBody } from '@/lib/schemas/gallery';
import publicList from '../../pages/api/gallery/index';
import publicAlbum from '../../pages/api/gallery/[slug]';
import adminList from '../../pages/api/admin/gallery/index';
import adminReorder from '../../pages/api/admin/gallery/reorder';
import adminAlbum from '../../pages/api/admin/gallery/[albumId]/index';
import adminImages from '../../pages/api/admin/gallery/[albumId]/images/index';
import adminImageReorder from '../../pages/api/admin/gallery/[albumId]/images/reorder';
import adminImage from '../../pages/api/admin/gallery/[albumId]/images/[imageId]';
import { albumSlugs, loadAlbum, loadGalleryIndex } from '../../app/gallery/load-gallery';

/**
 * The image gallery: repository, public API, admin API and the pages' loaders,
 * against a real database. UploadThing is mocked — there is no storage here —
 * so an upload is a key the mock reports as present (or not).
 */

jest.mock('@/lib/storage/uploadthing', () => ({
  isStorageConfigured: jest.fn(() => true),
  lookupFile: jest.fn(),
  deleteFile: jest.fn(() => Promise.resolve()),
  deleteFiles: jest.fn(() => Promise.resolve()),
}));

const storageMock = jest.mocked(storage);

/** The account the test bearer tokens carry (setup/helpers.ts), so audit rows can reference it. */
const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const MISSING = '00000000-0000-4000-8000-00000000dead';

describeWithDatabase('image gallery', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    storageMock.lookupFile.mockImplementation((key: string) =>
      Promise.resolve({ exists: true, sizeBytes: 1000, url: `https://utfs.io/f/${key}` }),
    );
    await truncateAll();
    await query(
      `INSERT INTO users (id, email, full_name, role) VALUES ($1, 'editor@cobuilt.test', 'Test Editor', 'editor')`,
      [ACTOR_ID],
    );
  });

  const album = (overrides: Record<string, unknown> = {}) =>
    gallery.create(createAlbumBody.parse({ title: 'Ocean Ridge handover', category: 'completed_projects', ...overrides }));

  const photo = (n: number, overrides: Partial<gallery.ImageInsert> = {}): gallery.ImageInsert => ({
    url: `/images/photo-${n}.webp`,
    fileKey: null,
    altText: `Photograph ${n} of the handover`,
    caption: null,
    width: 1200,
    height: 900,
    takenOn: null,
    ...overrides,
  });

  async function project(slug: string, publishedAt: string | null = new Date().toISOString()) {
    return (await queryOne<{ id: string }>(
      `INSERT INTO projects (title, slug, status, published_at) VALUES ($1, $2, 'completed', $3) RETURNING id`,
      [slug.replace(/-/g, ' '), slug, publishedAt],
    ))!.id;
  }

  async function auditActions(): Promise<string[]> {
    const { rows } = await query<{ action: string }>(`SELECT action FROM audit_log ORDER BY id`);
    return rows.map((row) => row.action);
  }

  describe('schema', () => {
    it('refuses an image without alt text, and an unknown category', async () => {
      const a = await album();
      await expect(
        query(`INSERT INTO gallery_images (album_id, image_url, alt_text) VALUES ($1, '/x.webp', '  ')`, [a.id]),
      ).rejects.toThrow(/gallery_images_alt_text_present/);
      await expect(
        query(`INSERT INTO gallery_images (album_id, image_url) VALUES ($1, '/x.webp')`, [a.id]),
      ).rejects.toThrow(/alt_text/);
      await expect(query(`UPDATE gallery_albums SET category = 'parties' WHERE id = $1`, [a.id])).rejects.toThrow(
        /gallery_albums_category_valid/,
      );
    });
  });

  describe('repository', () => {
    it('creates a draft at the end of the list, with a slug from the title', async () => {
      const first = await album({ published: true });
      const second = await album();

      expect(second).toMatchObject({ slug: 'ocean-ridge-handover-2', published: false, imageCount: 0, cover: null });
      expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
    });

    it('shows only published albums with images, in order, with the cover falling back to the first', async () => {
      const live = await album({ title: 'Live', published: true });
      const empty = await album({ title: 'Empty', published: true });
      const draft = await album({ title: 'Draft' });
      const [one, two] = await gallery.addImages(live.id, [photo(1), photo(2)]);
      await gallery.addImages(draft.id, [photo(3)]);

      const page = await gallery.listPublished();
      expect(page.results.map((a) => a.slug)).toEqual(['live']);
      expect(page.results[0]).toMatchObject({ imageCount: 2, cover: { url: one!.url, alt: one!.alt } });
      expect(await gallery.findPublishedBySlug('empty')).toBeNull();
      expect(await gallery.findPublishedBySlug('draft')).toBeNull();
      expect(empty.imageCount).toBe(0);

      await gallery.update(live.id, { coverImageId: two!.id });
      expect((await gallery.findPublishedBySlug('live'))!.cover).toMatchObject({ url: two!.url });

      // Deleting the cover falls back to the first image rather than dangling.
      await gallery.removeImage(live.id, two!.id);
      const after = await gallery.findById(live.id);
      expect(after).toMatchObject({ coverImageId: null, cover: { url: one!.url }, imageCount: 1 });
    });

    it('appends images in order and reorders only when given every image of the album', async () => {
      const a = await album();
      const b = await album({ title: 'Other' });
      const [one, two] = await gallery.addImages(a.id, [photo(1), photo(2)]);
      const [three] = await gallery.addImages(a.id, [photo(3, { caption: 'Keys handed over', takenOn: '2026-03-14' })]);
      const [elsewhere] = await gallery.addImages(b.id, [photo(4)]);

      expect((await gallery.imagesFor(a.id)).map((i) => i.id)).toEqual([one!.id, two!.id, three!.id]);
      expect(three).toMatchObject({ caption: 'Keys handed over', takenOn: '2026-03-14', width: 1200 });

      expect(await gallery.reorderImages(a.id, [three!.id, one!.id])).toBe(false);
      expect(await gallery.reorderImages(a.id, [three!.id, one!.id, elsewhere!.id])).toBe(false);
      expect(await gallery.reorderImages(a.id, [three!.id, one!.id, two!.id])).toBe(true);
      expect((await gallery.imagesFor(a.id)).map((i) => i.id)).toEqual([three!.id, one!.id, two!.id]);
    });

    it('files an album under its project either way attached, and only while the project is live', async () => {
      const live = await project('ocean-ridge');
      const draft = await project('northgate', null);
      const byColumn = await album({ title: 'By column', published: true, projectId: live });
      const byArray = await album({ title: 'By array', published: true });
      const underDraft = await album({ title: 'Under draft', published: true, projectId: draft });
      await query(`UPDATE projects SET gallery_ids = ARRAY[$1]::uuid[] WHERE id = $2`, [byArray.id, live]);
      for (const a of [byColumn, byArray, underDraft]) await gallery.addImages(a.id, [photo(1)]);

      const filtered = await gallery.listPublished({ project: 'ocean-ridge' });
      expect(filtered.results.map((a) => a.slug).sort()).toEqual(['by-array', 'by-column']);
      expect((await gallery.listPublished({ project: live })).pagination.total).toBe(2);
      expect((await gallery.listPublished({ project: 'northgate' })).results).toEqual([]);

      // The card names a live project only.
      const underDraftCard = (await gallery.listPublished()).results.find((a) => a.slug === 'under-draft');
      expect(underDraftCard!.project).toBeNull();

      const facets = await gallery.publishedFacets();
      expect(facets.projects).toEqual([{ id: live, slug: 'ocean-ridge', title: 'ocean ridge', count: 2 }]);
      expect(facets.categories).toEqual([{ value: 'completed_projects', count: 3 }]);

      expect((await gallery.publishedForProject(live, [byArray.id])).map((a) => a.slug).sort()).toEqual([
        'by-array',
        'by-column',
      ]);
      // The project page's own gallery band reads the same images.
      expect((await galleryForProject(live, [byArray.id])).flatMap((a) => a.imageUrls)).toHaveLength(2);
    });

    it('deletes an album with its images, returns their file keys, and unlinks it from projects', async () => {
      const p = await project('ocean-ridge');
      const a = await album();
      await gallery.addImages(a.id, [photo(1, { fileKey: 'key-1' }), photo(2)]);
      await query(`UPDATE projects SET gallery_ids = ARRAY[$1]::uuid[] WHERE id = $2`, [a.id, p]);

      expect(await gallery.remove(a.id)).toMatchObject({ id: a.id, fileKeys: ['key-1'] });
      expect(await gallery.remove(a.id)).toBeNull();
      expect((await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM gallery_images`))!.n).toBe(0);
      expect((await queryOne<{ ids: string[] }>(`SELECT gallery_ids AS ids FROM projects WHERE id = $1`, [p]))!.ids).toEqual([]);
    });
  });

  describe('admin API', () => {
    it('requires gallery:write: anonymous 401, viewer 403, editor 200', async () => {
      expect((await callRoute(adminList)).status).toBe(401);
      expect((await callRoute(adminList, { as: 'viewer' })).status).toBe(403);
      expect((await callRoute(adminList, { as: 'investor' })).status).toBe(403);

      const res = await callRoute(adminList, { as: 'editor' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ results: [] });
    });

    it('creates, publishes and audits an album, and refuses an unknown project or category', async () => {
      const bad = await callRoute(adminList, {
        method: 'POST',
        as: 'editor',
        body: { title: 'Launch night', category: 'parties' },
      });
      expect(bad.status).toBe(422);
      expect(bad.body.error.details[0].field).toBe('category');

      const noProject = await callRoute(adminList, {
        method: 'POST',
        as: 'editor',
        body: { title: 'Launch night', category: 'events', projectId: MISSING },
      });
      expect(noProject.status).toBe(422);

      const created = await callRoute(adminList, {
        method: 'POST',
        as: 'editor',
        body: { title: 'Launch night', category: 'events' },
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ slug: 'launch-night', published: false, category: 'events' });

      const published = await callRoute(adminAlbum, {
        method: 'PATCH',
        as: 'editor',
        query: { albumId: created.body.id },
        body: { published: true, description: 'The show villa opens.' },
      });
      expect(published.status).toBe(200);
      expect(published.body).toMatchObject({ published: true, images: [] });

      expect(await auditActions()).toEqual(['gallery.album.created', 'gallery.album.updated']);
    });

    it('requires alt text on every image added, by upload or by link', async () => {
      const a = await album();
      const add = (images: unknown[]) =>
        callRoute(adminImages, { method: 'POST', as: 'editor', query: { albumId: a.id }, body: { images } });

      const noAlt = await add([{ imageUrl: 'https://example.com/a.jpg' }]);
      expect(noAlt.status).toBe(422);
      expect(noAlt.body.error.details[0].field).toBe('images.0.altText');

      const blankAlt = await add([{ fileKey: 'abc', altText: '   ' }]);
      expect(blankAlt.status).toBe(422);

      const both = await add([{ fileKey: 'abc', imageUrl: 'https://example.com/a.jpg', altText: 'A crane' }]);
      expect(both.status).toBe(422);

      const http = await add([{ imageUrl: 'http://example.com/a.jpg', altText: 'A crane on site' }]);
      expect(http.status).toBe(422);
      const protocolRelative = await add([{ imageUrl: '//example.com/a.jpg', altText: 'A crane on site' }]);
      expect(protocolRelative.status).toBe(422);

      expect(await gallery.imagesFor(a.id)).toEqual([]);
    });

    it('adds uploaded and linked images, resolving an upload’s URL from storage', async () => {
      const a = await album();
      const res = await callRoute(adminImages, {
        method: 'POST',
        as: 'editor',
        query: { albumId: a.id },
        body: {
          images: [
            { fileKey: 'ut-key-1', altText: 'Tower crane over the frame', caption: 'Level four', width: 4000, height: 3000 },
            { imageUrl: '/images/construction-site.webp', altText: 'Concrete frame with scaffolding' },
          ],
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.results).toEqual([
        expect.objectContaining({ url: 'https://utfs.io/f/ut-key-1', fileKey: 'ut-key-1', caption: 'Level four', width: 4000 }),
        expect.objectContaining({ url: '/images/construction-site.webp', fileKey: null, width: null }),
      ]);
      expect(storageMock.lookupFile).toHaveBeenCalledWith('ut-key-1');
      expect(await auditActions()).toEqual(['gallery.images.added']);

      // The same file cannot be registered twice.
      const again = await callRoute(adminImages, {
        method: 'POST',
        as: 'editor',
        query: { albumId: a.id },
        body: { images: [{ fileKey: 'ut-key-1', altText: 'Tower crane again' }] },
      });
      expect(again.status).toBe(409);
    });

    it('refuses an upload that never reached storage, and adds nothing from the batch', async () => {
      const a = await album();
      storageMock.lookupFile.mockImplementation((key: string) =>
        Promise.resolve(
          key === 'gone'
            ? { exists: false, sizeBytes: 0, url: null }
            : { exists: true, sizeBytes: 1, url: `https://utfs.io/f/${key}` },
        ),
      );

      const res = await callRoute(adminImages, {
        method: 'POST',
        as: 'editor',
        query: { albumId: a.id },
        body: { images: [{ fileKey: 'fine', altText: 'Fine photograph' }, { fileKey: 'gone', altText: 'Lost photograph' }] },
      });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('images.1.fileKey');
      expect(await gallery.imagesFor(a.id)).toEqual([]);

      storageMock.isStorageConfigured.mockReturnValueOnce(false);
      const unconfigured = await callRoute(adminImages, {
        method: 'POST',
        as: 'editor',
        query: { albumId: a.id },
        body: { images: [{ fileKey: 'fine', altText: 'Fine photograph' }] },
      });
      expect(unconfigured.status).toBe(503);
    });

    it('updates alt text and caption, but never clears the alt text', async () => {
      const a = await album();
      const [image] = await gallery.addImages(a.id, [photo(1)]);
      const path = { albumId: a.id, imageId: image!.id };

      const cleared = await callRoute(adminImage, { method: 'PATCH', as: 'editor', query: path, body: { altText: '' } });
      expect(cleared.status).toBe(422);
      const nulled = await callRoute(adminImage, { method: 'PATCH', as: 'editor', query: path, body: { altText: null } });
      expect(nulled.status).toBe(422);

      const ok = await callRoute(adminImage, {
        method: 'PATCH',
        as: 'editor',
        query: path,
        body: { altText: 'Residents collecting keys at the entrance', caption: 'Handover day', takenOn: '2026-05-01' },
      });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({
        alt: 'Residents collecting keys at the entrance',
        caption: 'Handover day',
        takenOn: '2026-05-01',
      });

      const wrongAlbum = await callRoute(adminImage, {
        method: 'PATCH',
        as: 'editor',
        query: { albumId: (await album({ title: 'Other' })).id, imageId: image!.id },
        body: { caption: 'Nope' },
      });
      expect(wrongAlbum.status).toBe(404);
    });

    it('sets a cover only from the album’s own images', async () => {
      const a = await album();
      const b = await album({ title: 'Other' });
      const [own] = await gallery.addImages(a.id, [photo(1)]);
      const [foreign] = await gallery.addImages(b.id, [photo(2)]);

      const refused = await callRoute(adminAlbum, {
        method: 'PATCH',
        as: 'editor',
        query: { albumId: a.id },
        body: { coverImageId: foreign!.id },
      });
      expect(refused.status).toBe(422);
      expect(refused.body.error.details[0].field).toBe('coverImageId');

      const ok = await callRoute(adminAlbum, {
        method: 'PATCH',
        as: 'editor',
        query: { albumId: a.id },
        body: { coverImageId: own!.id },
      });
      expect(ok.status).toBe(200);
      expect(ok.body.coverImageId).toBe(own!.id);
    });

    it('lets an editor delete an image, deleting its stored file', async () => {
      const a = await album();
      const [uploaded, linked] = await gallery.addImages(a.id, [photo(1, { fileKey: 'ut-key' }), photo(2)]);

      const first = await callRoute(adminImage, {
        method: 'DELETE',
        as: 'editor',
        query: { albumId: a.id, imageId: uploaded!.id },
      });
      expect(first.status).toBe(204);
      expect(storageMock.deleteFile).toHaveBeenCalledWith('ut-key');

      const second = await callRoute(adminImage, {
        method: 'DELETE',
        as: 'editor',
        query: { albumId: a.id, imageId: linked!.id },
      });
      expect(second.status).toBe(204);
      expect(storageMock.deleteFile).toHaveBeenCalledTimes(1);
      expect(await auditActions()).toEqual(['gallery.image.deleted', 'gallery.image.deleted']);
    });

    it('lets only an administrator delete an album, and deletes its stored files', async () => {
      const a = await album();
      await gallery.addImages(a.id, [photo(1, { fileKey: 'k1' }), photo(2, { fileKey: 'k2' }), photo(3)]);

      const asEditor = await callRoute(adminAlbum, { method: 'DELETE', as: 'editor', query: { albumId: a.id } });
      expect(asEditor.status).toBe(403);
      expect(await gallery.findById(a.id)).not.toBeNull();

      const asAdmin = await callRoute(adminAlbum, { method: 'DELETE', as: 'admin', query: { albumId: a.id } });
      expect(asAdmin.status).toBe(204);
      expect(await gallery.findById(a.id)).toBeNull();
      expect(storageMock.deleteFiles).toHaveBeenCalledWith(expect.arrayContaining(['k1', 'k2']));
    });

    it('reorders albums and images as whole lists, refusing a partial one', async () => {
      const a = await album({ title: 'Alpha' });
      const b = await album({ title: 'Beta' });

      expect((await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id] } })).status).toBe(422);
      const ok = await callRoute(adminReorder, { method: 'POST', as: 'editor', body: { ids: [b.id, a.id] } });
      expect(ok.status).toBe(200);
      expect(ok.body.results.map((x: { title: string }) => x.title)).toEqual(['Beta', 'Alpha']);
      expect((await callRoute(adminReorder, { method: 'POST', as: 'viewer', body: { ids: [a.id, b.id] } })).status).toBe(403);

      const [one, two] = await gallery.addImages(a.id, [photo(1), photo(2)]);
      const partial = await callRoute(adminImageReorder, {
        method: 'POST',
        as: 'editor',
        query: { albumId: a.id },
        body: { ids: [two!.id] },
      });
      expect(partial.status).toBe(422);
      const swapped = await callRoute(adminImageReorder, {
        method: 'POST',
        as: 'editor',
        query: { albumId: a.id },
        body: { ids: [two!.id, one!.id] },
      });
      expect(swapped.status).toBe(200);
      expect(swapped.body.results.map((i: { id: string }) => i.id)).toEqual([two!.id, one!.id]);
      expect(await auditActions()).toEqual(['gallery.album.reordered', 'gallery.images.reordered']);
    });
  });

  describe('public API', () => {
    it('lists published albums with images only, filtered by category and project, cacheable', async () => {
      const p = await project('ocean-ridge');
      const handover = await album({ title: 'Handover', published: true, projectId: p });
      const launch = await album({ title: 'Launch', published: true, category: 'events' });
      const draft = await album({ title: 'Draft', category: 'events' });
      for (const a of [handover, launch, draft]) await gallery.addImages(a.id, [photo(1)]);

      const all = await callRoute(publicList);
      expect(all.status).toBe(200);
      expect(all.body.results.map((a: { slug: string }) => a.slug)).toEqual(['handover', 'launch']);
      expect(all.body.results[0]).not.toHaveProperty('published');
      expect(all.body.facets.categories).toEqual(
        expect.arrayContaining([
          { value: 'completed_projects', count: 1 },
          { value: 'events', count: 1 },
        ]),
      );
      expect(all.headers['cache-control']).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');

      const events = await callRoute(publicList, { query: { category: 'events' } });
      expect(events.body.results.map((a: { slug: string }) => a.slug)).toEqual(['launch']);

      const byProject = await callRoute(publicList, { query: { project: 'ocean-ridge' } });
      expect(byProject.body.results.map((a: { slug: string }) => a.slug)).toEqual(['handover']);
      expect(byProject.body.results[0].project).toMatchObject({ slug: 'ocean-ridge' });

      const badCategory = await callRoute(publicList, { query: { category: 'parties' } });
      expect(badCategory.status).toBe(422);
    });

    it('serves a published album with its images and alt text, and 404s a draft or an empty one', async () => {
      const live = await album({ title: 'Live', published: true });
      await album({ title: 'Empty', published: true });
      const draft = await album({ title: 'Draft' });
      await gallery.addImages(live.id, [photo(1, { caption: 'From the north' }), photo(2)]);
      await gallery.addImages(draft.id, [photo(3)]);

      const res = await callRoute(publicAlbum, { query: { slug: 'live' } });
      expect(res.status).toBe(200);
      expect(res.body.images).toEqual([
        expect.objectContaining({ alt: 'Photograph 1 of the handover', caption: 'From the north', width: 1200, height: 900 }),
        expect.objectContaining({ alt: 'Photograph 2 of the handover', caption: null }),
      ]);
      // Storage keys are console-only.
      expect(res.body.images[0]).not.toHaveProperty('fileKey');

      expect((await callRoute(publicAlbum, { query: { slug: 'draft' } })).status).toBe(404);
      expect((await callRoute(publicAlbum, { query: { slug: 'empty' } })).status).toBe(404);
      // A token changes nothing: staff get the same published-only view.
      expect((await callRoute(publicAlbum, { as: 'admin', query: { slug: 'draft' } })).status).toBe(404);
    });
  });

  describe('pages', () => {
    it('read the published gallery when the database is up', async () => {
      const live = await album({ title: 'Live', published: true });
      await gallery.addImages(live.id, [photo(1)]);
      await album({ title: 'Draft' });

      const index = await loadGalleryIndex();
      expect(index.kind).toBe('ready');
      if (index.kind === 'ready') expect(index.albums.map((a) => a.slug)).toEqual(['live']);
      expect(await albumSlugs()).toEqual([{ slug: 'live' }]);
      expect((await loadAlbum('draft')).kind).toBe('not-found');
    });

    it('report the gallery unavailable, rather than failing, when the query fails', async () => {
      await query('ALTER TABLE gallery_albums RENAME TO gallery_albums_unavailable');
      try {
        // `cache` only deduplicates inside a React render, so these load afresh.
        expect((await loadGalleryIndex()).kind).toBe('unavailable');
        expect((await loadAlbum('anything')).kind).toBe('unavailable');
        expect(await albumSlugs()).toEqual([]);
      } finally {
        await query('ALTER TABLE gallery_albums_unavailable RENAME TO gallery_albums');
      }
    });
  });
});
