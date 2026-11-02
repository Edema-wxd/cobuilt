import type { PoolClient } from 'pg';
import { query, queryOne, transaction } from '../db';
import { toDateOnly } from '../serializers';
import type { GalleryCategory } from '../gallery';
import type {
  CreateAlbumBody,
  ListGalleryQuery,
  UpdateAlbumBody,
  UpdateImageBody,
} from '../schemas/gallery';
import { slugify, uniqueSlug } from '../slug';
import { paginate, type Paginated } from '@/types/models';

/**
 * Image gallery persistence: albums (`gallery_albums`) and their images
 * (`gallery_images`, db/migrations/0020).
 *
 * Rows are mapped to their API shape here, as services and leadership are:
 * nothing reads a raw gallery row, and the column names would otherwise leak
 * into every caller.
 *
 * Public reads return published albums that hold at least one image — an empty
 * album has nothing to show and no cover — and name an album's project only
 * while that project is itself live. The admin reads return everything.
 */

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
  /** Intrinsic pixel size, when it was known at upload. */
  width: number | null;
  height: number | null;
  /** YYYY-MM-DD. */
  takenOn: string | null;
}

export interface AdminGalleryImage extends GalleryImage {
  /** Set for a file uploaded to UploadThing, which is deleted with the image. */
  fileKey: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryCover {
  url: string;
  /** Empty for an external cover set in the CMS, which carries no description. */
  alt: string;
  width: number | null;
  height: number | null;
}

export interface GalleryProjectLink {
  id: string;
  slug: string;
  title: string;
}

/** An album card: `/api/gallery`, the `/gallery` grid and a project page's albums. */
export interface GalleryAlbumSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: GalleryCategory;
  project: GalleryProjectLink | null;
  cover: GalleryCover | null;
  imageCount: number;
  updatedAt: string;
}

export interface GalleryAlbum extends GalleryAlbumSummary {
  images: GalleryImage[];
}

export interface AdminGalleryAlbum extends GalleryAlbumSummary {
  project: (GalleryProjectLink & { isPublished: boolean }) | null;
  published: boolean;
  sortOrder: number;
  coverImageId: string | null;
  createdAt: string;
}

export interface AdminGalleryAlbumDetail extends AdminGalleryAlbum {
  images: AdminGalleryImage[];
}

interface AlbumRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: GalleryCategory;
  published: boolean;
  sort_order: number;
  cover_image_id: string | null;
  cover_image_url: string | null;
  created_at: Date;
  updated_at: Date;
  project_id: string | null;
  project_slug: string | null;
  project_title: string | null;
  project_live: boolean;
  image_count: number;
  first_url: string | null;
  first_alt: string | null;
  first_width: number | null;
  first_height: number | null;
}

interface ImageRow {
  id: string;
  album_id: string;
  image_url: string;
  file_key: string | null;
  alt_text: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  taken_on: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Albums and the one project each documents. An album is attached either way
 * round, as on the project page (`galleryForProject`): by its own
 * `project_id`, which the console sets, or — when that is empty — by a
 * project's `gallery_ids`, which the projects API writes. Resolving it here
 * once means the card, the project filter and its counts cannot disagree.
 */
const ALBUM_FROM = `
    FROM gallery_albums a
    LEFT JOIN LATERAL (
      SELECT p.id, p.slug, p.title,
             (p.published_at IS NOT NULL AND p.published_at <= NOW()) AS live
        FROM projects p
       WHERE p.deleted_at IS NULL
         AND (p.id = a.project_id OR (a.project_id IS NULL AND a.id = ANY(p.gallery_ids)))
       ORDER BY p.created_at
       LIMIT 1
    ) p ON TRUE
`;

/**
 * Every album column the cards need, with its image count and the image its
 * cover falls back to: the chosen cover, else the first in the album's order.
 */
const ALBUM_SELECT = `
  SELECT a.id, a.slug, a.title, a.description, a.category, a.published, a.sort_order,
         a.cover_image_id, a.cover_image_url, a.created_at, a.updated_at,
         p.id AS project_id, p.slug AS project_slug, p.title AS project_title,
         coalesce(p.live, FALSE) AS project_live,
         (SELECT count(*)::int FROM gallery_images i WHERE i.album_id = a.id) AS image_count,
         first.image_url AS first_url, first.alt_text AS first_alt,
         first.width AS first_width, first.height AS first_height
  ${ALBUM_FROM}
    LEFT JOIN LATERAL (
      SELECT i.image_url, i.alt_text, i.width, i.height
        FROM gallery_images i
       WHERE i.album_id = a.id
       ORDER BY (i.id = a.cover_image_id) DESC NULLS LAST, i.sort_order, i.created_at
       LIMIT 1
    ) first ON TRUE
`;

const ALBUM_ORDER = 'a.sort_order ASC, a.created_at ASC';

/** Published, and with something in it. */
const PUBLIC_ALBUM = 'a.published AND EXISTS (SELECT 1 FROM gallery_images i WHERE i.album_id = a.id)';

const IMAGE_COLUMNS = `
  id, album_id, image_url, file_key, alt_text, caption, width, height, taken_on,
  sort_order, created_at, updated_at
`;

const IMAGE_ORDER = 'sort_order ASC, created_at ASC';

function coverOf(row: AlbumRow): GalleryCover | null {
  // A cover chosen in the console wins; then a cover the CMS set by URL; then
  // the first image. The lateral join already put a chosen cover first.
  if (!row.cover_image_id && row.cover_image_url) {
    return { url: row.cover_image_url, alt: '', width: null, height: null };
  }
  if (!row.first_url) return null;
  return {
    url: row.first_url,
    alt: row.first_alt ?? '',
    width: row.first_width,
    height: row.first_height,
  };
}

function toSummary(row: AlbumRow): GalleryAlbumSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    project:
      row.project_id && row.project_live
        ? { id: row.project_id, slug: row.project_slug!, title: row.project_title! }
        : null,
    cover: coverOf(row),
    imageCount: Number(row.image_count),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toAdmin(row: AlbumRow): AdminGalleryAlbum {
  return {
    ...toSummary(row),
    project: row.project_id
      ? {
          id: row.project_id,
          slug: row.project_slug!,
          title: row.project_title!,
          isPublished: row.project_live,
        }
      : null,
    published: row.published,
    sortOrder: row.sort_order,
    coverImageId: row.cover_image_id,
    createdAt: row.created_at.toISOString(),
  };
}

function toImage(row: ImageRow): GalleryImage {
  return {
    id: row.id,
    url: row.image_url,
    alt: row.alt_text,
    caption: row.caption,
    width: row.width,
    height: row.height,
    takenOn: toDateOnly(row.taken_on),
  };
}

function toAdminImage(row: ImageRow): AdminGalleryImage {
  return {
    ...toImage(row),
    fileKey: row.file_key,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/* ---------------------------------------------------------------- public */

/** Published albums, in editorial order, optionally filtered by category and project. */
export async function listPublished(
  filters: Pick<ListGalleryQuery, 'category' | 'project'> & { page?: number; pageSize?: number } = {},
): Promise<Paginated<GalleryAlbumSummary>> {
  const conditions = [PUBLIC_ALBUM];
  const params: unknown[] = [];

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`a.category = $${params.length}`);
  }
  if (filters.project) {
    // A project's slug or id; only a live project's albums are filed under it.
    params.push(filters.project);
    conditions.push(`p.live AND (p.slug = $${params.length} OR p.id::text = $${params.length})`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 500;

  const [{ rows }, total] = await Promise.all([
    query<AlbumRow>(
      `${ALBUM_SELECT} ${where} ORDER BY ${ALBUM_ORDER}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    ),
    queryOne<{ count: number }>(`SELECT count(*)::int AS count ${ALBUM_FROM} ${where}`, params),
  ]);

  return paginate(rows.map(toSummary), Number(total?.count ?? 0), page, pageSize);
}

export interface GalleryFacets {
  categories: Array<{ value: GalleryCategory; count: number }>;
  /** Live projects with at least one published album, by title. */
  projects: Array<GalleryProjectLink & { count: number }>;
}

/** What the gallery's filters can offer: only values with albums behind them. */
export async function publishedFacets(): Promise<GalleryFacets> {
  const [categories, projects] = await Promise.all([
    query<{ value: GalleryCategory; count: number }>(
      `SELECT a.category AS value, count(*)::int AS count
         FROM gallery_albums a
        WHERE ${PUBLIC_ALBUM}
        GROUP BY a.category`,
    ),
    query<GalleryProjectLink & { count: number }>(
      `SELECT p.id, p.slug, p.title, count(*)::int AS count
         ${ALBUM_FROM}
        WHERE p.live AND ${PUBLIC_ALBUM}
        GROUP BY p.id, p.slug, p.title
        ORDER BY p.title`,
    ),
  ]);

  return { categories: categories.rows, projects: projects.rows };
}

/** A published album with its images, in order; null when there is none to show. */
export async function findPublishedBySlug(slug: string): Promise<GalleryAlbum | null> {
  const row = await queryOne<AlbumRow>(`${ALBUM_SELECT} WHERE a.slug = $1 AND ${PUBLIC_ALBUM}`, [slug]);
  if (!row) return null;

  const { rows } = await query<ImageRow>(
    `SELECT ${IMAGE_COLUMNS} FROM gallery_images WHERE album_id = $1 ORDER BY ${IMAGE_ORDER}`,
    [row.id],
  );
  return { ...toSummary(row), images: rows.map(toImage) };
}

/** Published album slugs, to prerender at build time. */
export async function publishedSlugs(): Promise<string[]> {
  const { rows } = await query<{ slug: string }>(
    `SELECT a.slug FROM gallery_albums a WHERE ${PUBLIC_ALBUM} ORDER BY ${ALBUM_ORDER}`,
  );
  return rows.map((row) => row.slug);
}

/** A project page's "Photo albums": its published albums, either way attached. */
export async function publishedForProject(
  projectId: string,
  albumIds: readonly string[] = [],
): Promise<GalleryAlbumSummary[]> {
  const { rows } = await query<AlbumRow>(
    `${ALBUM_SELECT}
      WHERE ${PUBLIC_ALBUM} AND (a.project_id = $1 OR a.id = ANY($2::uuid[]))
      ORDER BY ${ALBUM_ORDER}`,
    [projectId, albumIds],
  );
  return rows.map(toSummary);
}

/* ----------------------------------------------------------------- admin */

export async function listAll(): Promise<AdminGalleryAlbum[]> {
  const { rows } = await query<AlbumRow>(`${ALBUM_SELECT} ORDER BY ${ALBUM_ORDER}`);
  return rows.map(toAdmin);
}

export async function findById(id: string): Promise<AdminGalleryAlbum | null> {
  const row = await queryOne<AlbumRow>(`${ALBUM_SELECT} WHERE a.id = $1`, [id]);
  return row ? toAdmin(row) : null;
}

export async function imagesFor(albumId: string): Promise<AdminGalleryImage[]> {
  const { rows } = await query<ImageRow>(
    `SELECT ${IMAGE_COLUMNS} FROM gallery_images WHERE album_id = $1 ORDER BY ${IMAGE_ORDER}`,
    [albumId],
  );
  return rows.map(toAdminImage);
}

/** The album with every image, for the console's editor. */
export async function findDetail(id: string): Promise<AdminGalleryAlbumDetail | null> {
  const album = await findById(id);
  return album ? { ...album, images: await imagesFor(id) } : null;
}

/** Fields the write API accepts, against the column each one sets. */
const COLUMN_FOR: Record<keyof UpdateAlbumBody, string> = {
  title: 'title',
  slug: 'slug',
  description: 'description',
  category: 'category',
  projectId: 'project_id',
  published: 'published',
  coverImageId: 'cover_image_id',
};

/**
 * Creates an album at the end of the list. The slug is made from the title
 * when none is given, and suffixed (`-2`) if it is already taken.
 */
export async function create(input: CreateAlbumBody): Promise<AdminGalleryAlbum> {
  const slug = await uniqueSlug('gallery_albums', input.slug ?? slugify(input.title));

  const row = await queryOne<{ id: string }>(
    `INSERT INTO gallery_albums (title, slug, description, category, project_id, published, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, (SELECT coalesce(max(sort_order), 0) + 10 FROM gallery_albums))
     RETURNING id`,
    [input.title, slug, input.description, input.category, input.projectId, input.published],
  );

  return (await findById(row!.id))!;
}

/**
 * Applies the fields present in `input`. Returns null when the album does not
 * exist. A cover must be one of the album's own images: the caller checks
 * with `imageInAlbum` first.
 */
export async function update(id: string, input: UpdateAlbumBody): Promise<AdminGalleryAlbum | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(COLUMN_FOR)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return findById(id);

  params.push(id);
  const { rowCount } = await query(
    `UPDATE gallery_albums SET ${assignments.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return rowCount === 0 ? null : findById(id);
}

/**
 * Deletes an album and its images (by cascade), and its id from any project's
 * `gallery_ids`, an array with no foreign key to cascade through. Returns what
 * was removed, with the stored files' keys so the caller can delete them.
 */
export async function remove(
  id: string,
): Promise<{ id: string; title: string; slug: string; fileKeys: string[] } | null> {
  return transaction(async (client) => {
    const { rows: keys } = await client.query<{ file_key: string }>(
      `SELECT file_key FROM gallery_images WHERE album_id = $1 AND file_key IS NOT NULL`,
      [id],
    );
    const { rows } = await client.query<{ id: string; title: string; slug: string }>(
      `DELETE FROM gallery_albums WHERE id = $1 RETURNING id, title, slug`,
      [id],
    );
    const removed = rows[0];
    if (!removed) return null;

    await client.query(
      `UPDATE projects SET gallery_ids = array_remove(gallery_ids, $1::uuid)
        WHERE $1::uuid = ANY(gallery_ids)`,
      [id],
    );
    return { ...removed, fileKeys: keys.map((row) => row.file_key) };
  });
}

/**
 * Sets the order of `table`'s rows (within `scope`, when given) to the order
 * of `ids`, which must name every row exactly once. Returns false, changing
 * nothing, when it does not — a list reordered from a stale screen would
 * otherwise drop or misplace a row added in the meantime.
 */
async function setOrder(
  client: PoolClient,
  table: 'gallery_albums' | 'gallery_images',
  ids: readonly string[],
  scope?: { column: 'album_id'; value: string },
): Promise<boolean> {
  // Locks the rows so one created mid-reorder waits for this to finish.
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM ${table} ${scope ? `WHERE ${scope.column} = $1` : ''} FOR UPDATE`,
    scope ? [scope.value] : [],
  );
  const existing = new Set(rows.map((row) => row.id));
  if (existing.size !== ids.length || !ids.every((id) => existing.has(id))) return false;

  await client.query(
    `UPDATE ${table} t SET sort_order = o.position * 10
       FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position)
      WHERE t.id = o.id`,
    [ids],
  );
  return true;
}

export async function reorder(ids: readonly string[]): Promise<boolean> {
  return transaction((client) => setOrder(client, 'gallery_albums', ids));
}

/* ---------------------------------------------------------------- images */

/** An image to store, its URL already resolved (from UploadThing for an upload). */
export interface ImageInsert {
  url: string;
  fileKey: string | null;
  altText: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  takenOn: string | null;
}

/** Appends images to the end of an album, in the order given. */
export async function addImages(
  albumId: string,
  images: readonly ImageInsert[],
): Promise<AdminGalleryImage[]> {
  return transaction(async (client) => {
    // Serialises concurrent additions to one album so their positions cannot collide.
    await client.query(`SELECT id FROM gallery_albums WHERE id = $1 FOR UPDATE`, [albumId]);

    const { rows } = await client.query<ImageRow>(
      `INSERT INTO gallery_images
         (album_id, image_url, file_key, alt_text, caption, width, height, taken_on, sort_order)
       SELECT $1, o.url, o.file_key, o.alt_text, o.caption, o.width, o.height, o.taken_on,
              (SELECT coalesce(max(sort_order), 0) FROM gallery_images WHERE album_id = $1) + o.position * 10
         FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[], $8::date[])
              WITH ORDINALITY AS o(url, file_key, alt_text, caption, width, height, taken_on, position)
       RETURNING ${IMAGE_COLUMNS}`,
      [
        albumId,
        images.map((image) => image.url),
        images.map((image) => image.fileKey),
        images.map((image) => image.altText),
        images.map((image) => image.caption),
        images.map((image) => image.width),
        images.map((image) => image.height),
        images.map((image) => image.takenOn),
      ],
    );
    // Touches the album so its "updated" time and cached cards follow.
    await client.query(`UPDATE gallery_albums SET updated_at = NOW() WHERE id = $1`, [albumId]);
    return rows.sort((a, b) => a.sort_order - b.sort_order).map(toAdminImage);
  });
}

export async function findImage(albumId: string, imageId: string): Promise<AdminGalleryImage | null> {
  const row = await queryOne<ImageRow>(
    `SELECT ${IMAGE_COLUMNS} FROM gallery_images WHERE id = $1 AND album_id = $2`,
    [imageId, albumId],
  );
  return row ? toAdminImage(row) : null;
}

export async function imageInAlbum(albumId: string, imageId: string): Promise<boolean> {
  return (await findImage(albumId, imageId)) !== null;
}

/** Applies the fields present in `input`. Returns null when there is no such image in the album. */
export async function updateImage(
  albumId: string,
  imageId: string,
  input: UpdateImageBody,
): Promise<AdminGalleryImage | null> {
  const columns: Record<keyof UpdateImageBody, string> = {
    altText: 'alt_text',
    caption: 'caption',
    takenOn: 'taken_on',
  };
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(columns)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }
  if (assignments.length === 0) return findImage(albumId, imageId);

  params.push(imageId, albumId);
  const row = await queryOne<ImageRow>(
    `UPDATE gallery_images SET ${assignments.join(', ')}
      WHERE id = $${params.length - 1} AND album_id = $${params.length}
      RETURNING ${IMAGE_COLUMNS}`,
    params,
  );
  return row ? toAdminImage(row) : null;
}

/** Deletes one image. A cover that was this image falls back (ON DELETE SET NULL). */
export async function removeImage(albumId: string, imageId: string): Promise<AdminGalleryImage | null> {
  const row = await queryOne<ImageRow>(
    `DELETE FROM gallery_images WHERE id = $1 AND album_id = $2 RETURNING ${IMAGE_COLUMNS}`,
    [imageId, albumId],
  );
  return row ? toAdminImage(row) : null;
}

export async function reorderImages(albumId: string, ids: readonly string[]): Promise<boolean> {
  return transaction((client) =>
    setOrder(client, 'gallery_images', ids, { column: 'album_id', value: albumId }),
  );
}
