import { query, queryOne, transaction } from '../db';
import type { Paginated } from '@/types/models';
import { paginate } from '@/types/models';
import type { CreateVideoBody, ListVideosQuery, UpdateVideoBody } from '../schemas/videos';
import { slugify, uniqueSlug } from '../slug';
import type { VideoCategory } from '../videos';
import { youtubeVideoId, youtubeWatchUrl } from '../youtube';

/**
 * Video library persistence (db/migrations/0019).
 *
 * A row holds the YouTube video ID, never a link or embed code: the watch link
 * is rebuilt here and the embed on the page (src/lib/youtube.ts). Rows are
 * mapped to their API shape here, as for services, so the column names stay
 * in this file.
 *
 * Public reads return published videos only, and a video's project only while
 * that project is live: a draft, scheduled or deleted project is not linked
 * from the public site, though the film itself stays in the library. The
 * admin reads return every row and flag the project instead.
 */

interface VideoRow {
  id: string;
  youtube_id: string;
  title: string;
  slug: string;
  description: string;
  category: VideoCategory;
  project_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  recorded_on: string | null;
  featured: boolean;
  sort_order: number;
  published: boolean;
  created_at: Date;
  updated_at: Date;
  project_slug: string | null;
  project_title: string | null;
  project_image: string | null;
  project_live: boolean;
}

const LIVE_PROJECT =
  'p.id IS NOT NULL AND p.deleted_at IS NULL AND p.published_at IS NOT NULL AND p.published_at <= NOW()';

/*
 * `recorded_on` is read as text: a DATE is local midnight to node-postgres,
 * and serializing it would move it a day either side of UTC (decisions §2.11).
 */
const SELECT = `
  SELECT v.id, v.youtube_id, v.title, v.slug, v.description, v.category, v.project_id,
         v.thumbnail_url, v.duration_seconds, to_char(v.recorded_on, 'YYYY-MM-DD') AS recorded_on,
         v.featured, v.sort_order, v.published, v.created_at, v.updated_at,
         p.slug AS project_slug, p.title AS project_title, p.featured_image_url AS project_image,
         (${LIVE_PROJECT}) AS project_live
    FROM videos v
    LEFT JOIN projects p ON p.id = v.project_id
`;

const ORDER = 'v.sort_order ASC, v.created_at DESC';

/** The project a film documents, as the library links to it. */
export interface VideoProject {
  id: string;
  slug: string;
  title: string;
  featuredImageUrl: string | null;
}

/** A video as the public site and `/api/videos` show it. */
export interface PublicVideo {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: VideoCategory;
  youtubeId: string;
  watchUrl: string;
  /**
   * The still the site shows: the editor's thumbnail, else the project's
   * photograph, else null (the page has a house still). Never YouTube's own.
   */
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  /** `YYYY-MM-DD`. */
  recordedOn: string | null;
  featured: boolean;
  /** Null when there is none, or it is not live. */
  project: VideoProject | null;
}

export interface AdminVideo extends Omit<PublicVideo, 'thumbnailUrl' | 'project'> {
  /** The editor's own thumbnail, as stored. */
  thumbnailUrl: string | null;
  projectId: string | null;
  /** The linked project whatever its state; `isPublished` says whether the site links it. */
  project: (VideoProject & { isPublished: boolean }) | null;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function projectOf(row: VideoRow): VideoProject | null {
  if (!row.project_id || !row.project_slug || !row.project_title) return null;
  return {
    id: row.project_id,
    slug: row.project_slug,
    title: row.project_title,
    featuredImageUrl: row.project_image,
  };
}

function common(row: VideoRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    youtubeId: row.youtube_id,
    watchUrl: youtubeWatchUrl(row.youtube_id),
    durationSeconds: row.duration_seconds,
    recordedOn: row.recorded_on,
    featured: row.featured,
  };
}

function toPublic(row: VideoRow): PublicVideo {
  const project = row.project_live ? projectOf(row) : null;
  return {
    ...common(row),
    thumbnailUrl: row.thumbnail_url ?? project?.featuredImageUrl ?? null,
    project,
  };
}

function toAdmin(row: VideoRow): AdminVideo {
  const project = projectOf(row);
  return {
    ...common(row),
    thumbnailUrl: row.thumbnail_url,
    projectId: row.project_id,
    project: project ? { ...project, isPublished: row.project_live } : null,
    published: row.published,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** `%`, `_` and `\` typed into the search box are matched as themselves. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/* ---------------------------------------------------------------- public */

export type VideoFilters = Pick<ListVideosQuery, 'category' | 'project' | 'q'>;

function publishedWhere(filters: VideoFilters): { where: string; params: unknown[] } {
  const conditions = ['v.published'];
  const params: unknown[] = [];

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`v.category = $${params.length}`);
  }
  if (filters.project) {
    params.push(filters.project);
    conditions.push(`p.slug = $${params.length} AND ${LIVE_PROJECT}`);
  }
  if (filters.q) {
    params.push(likePattern(filters.q));
    const n = params.length;
    // A project's name is searched only where the page would show it.
    conditions.push(
      `(v.title ILIKE $${n} OR v.description ILIKE $${n} OR (${LIVE_PROJECT} AND p.title ILIKE $${n}))`,
    );
  }
  return { where: conditions.join(' AND '), params };
}

/** One page of published videos in display order — `GET /api/videos`. */
export async function listPublished(
  options: VideoFilters & { page: number; pageSize: number },
): Promise<Paginated<PublicVideo>> {
  const { where, params } = publishedWhere(options);

  const [{ rows }, count] = await Promise.all([
    query<VideoRow>(
      `${SELECT} WHERE ${where} ORDER BY ${ORDER}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, options.pageSize, (options.page - 1) * options.pageSize],
    ),
    queryOne<{ total: number }>(
      `SELECT count(*)::int AS total FROM videos v LEFT JOIN projects p ON p.id = v.project_id WHERE ${where}`,
      params,
    ),
  ]);

  return paginate(rows.map(toPublic), count?.total ?? 0, options.page, options.pageSize);
}

/**
 * Every published video, in display order, for the library page, which
 * filters in the browser. Capped well above any library CoBuilt will build by
 * hand, so a runaway import cannot make the page enormous.
 */
export async function listAllPublished(limit = 500): Promise<PublicVideo[]> {
  const { rows } = await query<VideoRow>(`${SELECT} WHERE v.published ORDER BY ${ORDER} LIMIT $1`, [limit]);
  return rows.map(toPublic);
}

export async function findPublishedBySlug(slug: string): Promise<PublicVideo | null> {
  const row = await queryOne<VideoRow>(`${SELECT} WHERE v.slug = $1 AND v.published`, [slug]);
  return row ? toPublic(row) : null;
}

/**
 * Other published films to watch next: the same project's first, then the
 * same category's, each in display order.
 */
export async function relatedTo(video: PublicVideo, limit = 3): Promise<PublicVideo[]> {
  const { rows } = await query<VideoRow>(
    `${SELECT}
      WHERE v.published AND v.id <> $1
        AND ((v.project_id = $2::uuid AND ${LIVE_PROJECT}) OR v.category = $3)
      ORDER BY coalesce(v.project_id = $2::uuid, FALSE) DESC, ${ORDER}
      LIMIT $4`,
    [video.id, video.project?.id ?? null, video.category, limit],
  );
  return rows.map(toPublic);
}

/** A live project's published films, for its project page. */
export async function listForProject(projectId: string): Promise<PublicVideo[]> {
  const { rows } = await query<VideoRow>(
    `${SELECT} WHERE v.published AND v.project_id = $1 AND ${LIVE_PROJECT} ORDER BY ${ORDER}`,
    [projectId],
  );
  return rows.map(toPublic);
}

/** The most recent published films in one category: by recording date, then when added. */
export async function latestInCategory(category: VideoCategory, limit = 3): Promise<PublicVideo[]> {
  const { rows } = await query<VideoRow>(
    `${SELECT} WHERE v.published AND v.category = $1
      ORDER BY v.recorded_on DESC NULLS LAST, v.created_at DESC
      LIMIT $2`,
    [category, limit],
  );
  return rows.map(toPublic);
}

/* ----------------------------------------------------------------- admin */

export async function listAll(): Promise<AdminVideo[]> {
  const { rows } = await query<VideoRow>(`${SELECT} ORDER BY ${ORDER}`);
  return rows.map(toAdmin);
}

export async function findById(id: string): Promise<AdminVideo | null> {
  const row = await queryOne<VideoRow>(`${SELECT} WHERE v.id = $1`, [id]);
  return row ? toAdmin(row) : null;
}

/** Whether a project exists and is not deleted — the only kind a video may point at. */
export async function projectExists(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return Boolean(row);
}

/** Fields the write API accepts, against the column each one sets. */
const COLUMN_FOR: Record<keyof Omit<UpdateVideoBody, 'youtubeUrl'>, string> = {
  title: 'title',
  slug: 'slug',
  description: 'description',
  category: 'category',
  projectId: 'project_id',
  thumbnailUrl: 'thumbnail_url',
  durationSeconds: 'duration_seconds',
  recordedOn: 'recorded_on',
  featured: 'featured',
  published: 'published',
};

/** The ID from a link the schema has already checked and made canonical. */
function idFrom(watchUrl: string): string {
  const id = youtubeVideoId(watchUrl);
  if (!id) throw new Error('Not a YouTube video link');
  return id;
}

/**
 * Adds a video at the end of the list. The slug is made from the title when
 * none is given, and suffixed (`-2`) if it is already taken. A video already
 * in the library is a unique violation, which the route reports as a 409.
 */
export async function create(input: CreateVideoBody): Promise<AdminVideo> {
  const slug = await uniqueSlug('videos', input.slug ?? slugify(input.title));

  const row = await queryOne<{ id: string }>(
    `INSERT INTO videos (
       youtube_id, title, slug, description, category, project_id, thumbnail_url,
       duration_seconds, recorded_on, featured, published, sort_order
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       (SELECT coalesce(max(sort_order), 0) + 10 FROM videos)
     )
     RETURNING id`,
    [
      idFrom(input.youtubeUrl),
      input.title,
      slug,
      input.description,
      input.category,
      input.projectId,
      input.thumbnailUrl,
      input.durationSeconds,
      input.recordedOn,
      input.featured,
      input.published,
    ],
  );

  return (await findById(row!.id))!;
}

/** Applies the fields present in `input`. Returns null when the video does not exist. */
export async function update(id: string, input: UpdateVideoBody): Promise<AdminVideo | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (input.youtubeUrl !== undefined) {
    params.push(idFrom(input.youtubeUrl));
    assignments.push(`youtube_id = $${params.length}`);
  }
  for (const [field, column] of Object.entries(COLUMN_FOR)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return findById(id);

  params.push(id);
  const { rowCount } = await query(
    `UPDATE videos SET ${assignments.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return rowCount === 0 ? null : findById(id);
}

/** Deletes a video. Returns the removed row, or null if there was none. */
export async function remove(
  id: string,
): Promise<{ id: string; title: string; slug: string; youtubeId: string } | null> {
  const row = await queryOne<{ id: string; title: string; slug: string; youtube_id: string }>(
    `DELETE FROM videos WHERE id = $1 RETURNING id, title, slug, youtube_id`,
    [id],
  );
  return row ? { id: row.id, title: row.title, slug: row.slug, youtubeId: row.youtube_id } : null;
}

/**
 * Sets the display order to the order of `ids`, which must name every video
 * exactly once. Returns false, changing nothing, when it does not — a list
 * reordered from a stale screen would otherwise drop or misplace a video
 * added in the meantime.
 */
export async function reorder(ids: readonly string[]): Promise<boolean> {
  return transaction(async (client) => {
    // Locks the rows so a video created mid-reorder waits for this to finish.
    const { rows } = await client.query<{ id: string }>(`SELECT id FROM videos FOR UPDATE`);
    const existing = new Set(rows.map((row) => row.id));
    if (existing.size !== ids.length || !ids.every((id) => existing.has(id))) return false;

    await client.query(
      `UPDATE videos v SET sort_order = o.position * 10
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position)
        WHERE v.id = o.id`,
      [ids],
    );
    return true;
  });
}
