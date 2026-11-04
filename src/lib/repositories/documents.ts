import { query, queryOne, transaction } from '../db';
import type { DocumentCategory, UpdateDocumentBody } from '../schemas/documents';
import { slugify, uniqueSlug } from '../slug';

/**
 * Download centre persistence (db/migrations/0021).
 *
 * Rows are mapped to their API shape here, as services.ts does: nothing reads
 * a raw document row, and the file key and counts must never reach a public
 * response by accident.
 *
 * Public reads return published documents only, and leave out a document
 * attached to a project that is not live, so a project profile cannot reveal
 * a draft project. The admin reads return every row.
 */

interface DocumentRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: DocumentCategory;
  file_url: string;
  file_key: string | null;
  file_type: string | null;
  file_size_bytes: string | null;
  project_id: string | null;
  project_title: string | null;
  project_slug: string | null;
  project_live: boolean | null;
  published: boolean;
  sort_order: number;
  download_count: string;
  downloads_30d?: number;
  created_at: Date;
  updated_at: Date;
}

const LIVE_PROJECT = 'p.published_at IS NOT NULL AND p.published_at <= NOW() AND p.deleted_at IS NULL';

const SELECT = `
  SELECT d.id, d.title, d.slug, d.description, d.category, d.file_url, d.file_key,
         d.file_type, d.file_size_bytes::text AS file_size_bytes, d.project_id,
         p.title AS project_title, p.slug AS project_slug, (${LIVE_PROJECT}) AS project_live,
         d.published, d.sort_order, d.download_count::text AS download_count,
         d.created_at, d.updated_at
    FROM documents d
    LEFT JOIN projects p ON p.id = d.project_id
`;

const ORDER = 'd.sort_order ASC, d.title ASC';

/** Published, and not attached to a project that is unpublished or deleted. */
const PUBLIC = `d.published AND (d.project_id IS NULL OR (${LIVE_PROJECT}))`;

/** A document as `/api/documents`, `/resources` and project pages show it. */
export interface PublicDocument {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: DocumentCategory;
  /** Lowercase extension, or null when a link does not name one. */
  fileType: string | null;
  fileSizeBytes: number | null;
  /** The tracked endpoint; the file's own URL is not published. */
  downloadUrl: string;
  project: { id: string; title: string; slug: string } | null;
}

export interface AdminDocument extends Omit<PublicDocument, 'project'> {
  fileUrl: string;
  /** Set when the file was uploaded through the console, and deleted with it. */
  fileKey: string | null;
  project: { id: string; title: string; slug: string; isPublished: boolean } | null;
  published: boolean;
  sortOrder: number;
  downloadCount: number;
  /** Downloads in the last 30 days, WAT; set on list reads only. */
  downloadsLast30Days?: number;
  createdAt: string;
  updatedAt: string;
}

/** The tracked download link for a document. */
export function downloadPath(id: string): string {
  return `/api/documents/${id}/download`;
}

function toPublic(row: DocumentRow): PublicDocument {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes),
    downloadUrl: downloadPath(row.id),
    project:
      row.project_id && row.project_title && row.project_slug
        ? { id: row.project_id, title: row.project_title, slug: row.project_slug }
        : null,
  };
}

function toAdmin(row: DocumentRow): AdminDocument {
  const base = toPublic(row);
  return {
    ...base,
    fileUrl: row.file_url,
    fileKey: row.file_key,
    project: base.project ? { ...base.project, isPublished: Boolean(row.project_live) } : null,
    published: row.published,
    sortOrder: row.sort_order,
    downloadCount: Number(row.download_count),
    ...(row.downloads_30d === undefined ? {} : { downloadsLast30Days: Number(row.downloads_30d) }),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/* ---------------------------------------------------------------- public */

export interface PublishedFilter {
  category?: DocumentCategory;
  /** Documents attached to this project. */
  projectId?: string;
}

/** Published documents in editorial order, optionally narrowed. */
export async function listPublished(filter: PublishedFilter = {}): Promise<PublicDocument[]> {
  const conditions = [PUBLIC];
  const params: unknown[] = [];

  if (filter.category) {
    params.push(filter.category);
    conditions.push(`d.category = $${params.length}`);
  }
  if (filter.projectId) {
    params.push(filter.projectId);
    conditions.push(`d.project_id = $${params.length}`);
  }

  const { rows } = await query<DocumentRow>(
    `${SELECT} WHERE ${conditions.join(' AND ')} ORDER BY ${ORDER}`,
    params,
  );
  return rows.map(toPublic);
}

/** A live project's id from its id or slug, for the `project` filter. */
export async function resolveLiveProject(idOrSlug: string): Promise<string | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const row = await queryOne<{ id: string }>(
    `SELECT p.id FROM projects p WHERE ${isUuid ? 'p.id = $1::uuid' : 'p.slug = $1'} AND ${LIVE_PROJECT}`,
    [idOrSlug],
  );
  return row?.id ?? null;
}

/** Where a published document's download goes, or null when it is not public. */
export async function findDownloadable(id: string): Promise<{ id: string; fileUrl: string } | null> {
  const row = await queryOne<{ id: string; file_url: string }>(
    `SELECT d.id, d.file_url FROM documents d LEFT JOIN projects p ON p.id = d.project_id
      WHERE d.id = $1 AND ${PUBLIC}`,
    [id],
  );
  return row ? { id: row.id, fileUrl: row.file_url } : null;
}

/**
 * Counts one download: the running total, and the day's count in West Africa
 * Time. Nothing about who downloaded is recorded.
 */
export async function recordDownload(id: string): Promise<void> {
  await transaction(async (client) => {
    await client.query(`UPDATE documents SET download_count = download_count + 1 WHERE id = $1`, [id]);
    await client.query(
      `INSERT INTO document_download_days (document_id, day, downloads)
       VALUES ($1, (NOW() AT TIME ZONE 'Africa/Lagos')::date, 1)
       ON CONFLICT (document_id, day) DO UPDATE SET downloads = document_download_days.downloads + 1`,
      [id],
    );
  });
}

/* ----------------------------------------------------------------- admin */

/** Every document, drafts included, in display order, with recent downloads. */
export async function listAll(): Promise<AdminDocument[]> {
  const { rows } = await query<DocumentRow>(
    `SELECT x.*,
            (SELECT coalesce(sum(dd.downloads), 0)::int FROM document_download_days dd
              WHERE dd.document_id = x.id
                AND dd.day > (NOW() AT TIME ZONE 'Africa/Lagos')::date - 30) AS downloads_30d
       FROM (${SELECT}) x
      ORDER BY x.sort_order ASC, x.title ASC`,
  );
  return rows.map(toAdmin);
}

export async function findById(id: string): Promise<AdminDocument | null> {
  const row = await queryOne<DocumentRow>(`${SELECT} WHERE d.id = $1`, [id]);
  return row ? toAdmin(row) : null;
}

export interface DocumentFile {
  fileUrl: string;
  fileKey: string | null;
  fileType: string | null;
  fileSizeBytes: number | null;
}

export interface CreateDocumentInput extends DocumentFile {
  title: string;
  slug?: string | undefined;
  description: string | null;
  category: DocumentCategory;
  projectId: string | null;
  published: boolean;
  createdBy: string | null;
}

/**
 * Creates a document at the end of the list. The slug is made from the title
 * when none is given, and suffixed (`-2`) if it is already taken.
 */
export async function create(input: CreateDocumentInput): Promise<AdminDocument> {
  const slug = await uniqueSlug('documents', input.slug ?? slugify(input.title));

  const row = await queryOne<{ id: string }>(
    `INSERT INTO documents (
       title, slug, description, category, file_url, file_key, file_type, file_size_bytes,
       project_id, published, created_by, sort_order
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       (SELECT coalesce(max(sort_order), 0) + 10 FROM documents)
     )
     RETURNING id`,
    [
      input.title,
      slug,
      input.description,
      input.category,
      input.fileUrl,
      input.fileKey,
      input.fileType,
      input.fileSizeBytes,
      input.projectId,
      input.published,
      input.createdBy,
    ],
  );

  return (await findById(row!.id))!;
}

export type UpdateDocumentInput = Omit<UpdateDocumentBody, 'fileKey' | 'fileUrl'> & Partial<DocumentFile>;

/** Fields the update accepts, against the column each one sets. */
const COLUMN_FOR: Record<keyof UpdateDocumentInput, string> = {
  title: 'title',
  slug: 'slug',
  description: 'description',
  category: 'category',
  projectId: 'project_id',
  published: 'published',
  fileUrl: 'file_url',
  fileKey: 'file_key',
  fileType: 'file_type',
  fileSizeBytes: 'file_size_bytes',
};

/** Applies the fields present in `input`. Returns null when the document does not exist. */
export async function update(id: string, input: UpdateDocumentInput): Promise<AdminDocument | null> {
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
    `UPDATE documents SET ${assignments.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return rowCount === 0 ? null : findById(id);
}

/** Deletes a document. Returns what the caller needs to clean up, or null if there was none. */
export async function remove(
  id: string,
): Promise<{ id: string; title: string; fileKey: string | null; projectId: string | null } | null> {
  const row = await queryOne<{ id: string; title: string; file_key: string | null; project_id: string | null }>(
    `DELETE FROM documents WHERE id = $1 RETURNING id, title, file_key, project_id`,
    [id],
  );
  return row ? { id: row.id, title: row.title, fileKey: row.file_key, projectId: row.project_id } : null;
}

/**
 * Sets the display order to the order of `ids`, which must name every
 * document exactly once. Returns false, changing nothing, when it does not —
 * a list reordered from a stale screen would otherwise drop or misplace a
 * document added in the meantime.
 */
export async function reorder(ids: readonly string[]): Promise<boolean> {
  return transaction(async (client) => {
    // Locks the rows so a document created mid-reorder waits for this to finish.
    const { rows } = await client.query<{ id: string }>(`SELECT id FROM documents FOR UPDATE`);
    const existing = new Set(rows.map((row) => row.id));
    if (existing.size !== ids.length || !ids.every((id) => existing.has(id))) return false;

    await client.query(
      `UPDATE documents d SET sort_order = o.position * 10
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position)
        WHERE d.id = o.id`,
      [ids],
    );
    return true;
  });
}
