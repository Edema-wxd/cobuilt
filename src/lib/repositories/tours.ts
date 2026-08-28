import { query, queryOne } from '../db';
import type { TourRow, TourType } from '@/types/models';

/** 3D virtual tour persistence (§7). */

const COLUMNS = `
  id, project_id, tour_name, tour_type, model_file_s3_key, file_size_bytes,
  thumbnail_url, tour_url, embed_code, description, featured, published,
  view_count, uploaded_at, processing_status, processing_error, updated_at
`;

export async function listForProject(
  projectId: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<TourRow[]> {
  const published = options.includeUnpublished ? '' : 'AND published = TRUE';

  const { rows } = await query<TourRow>(
    `SELECT ${COLUMNS} FROM virtual_tours
      WHERE project_id = $1 ${published}
      ORDER BY featured DESC, uploaded_at DESC`,
    [projectId],
  );

  return rows;
}

export async function findById(id: string): Promise<TourRow | null> {
  return queryOne<TourRow>(`SELECT ${COLUMNS} FROM virtual_tours WHERE id = $1`, [id]);
}

export interface CreateTourInput {
  projectId: string;
  tourName: string;
  tourType: TourType;
  modelFileS3Key?: string | null;
  fileSizeBytes?: number | null;
  thumbnailUrl?: string | null;
  tourUrl?: string | null;
  embedCode?: string | null;
  description?: string | null;
  featured?: boolean;
  published?: boolean;
  processingStatus?: TourRow['processing_status'];
  createdBy?: string | null;
}

export async function create(input: CreateTourInput): Promise<TourRow> {
  const row = await queryOne<TourRow>(
    `INSERT INTO virtual_tours (
       project_id, tour_name, tour_type, model_file_s3_key, file_size_bytes,
       thumbnail_url, tour_url, embed_code, description, featured, published,
       processing_status, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING ${COLUMNS}`,
    [
      input.projectId,
      input.tourName,
      input.tourType,
      input.modelFileS3Key ?? null,
      input.fileSizeBytes ?? null,
      input.thumbnailUrl ?? null,
      input.tourUrl ?? null,
      input.embedCode ?? null,
      input.description ?? null,
      input.featured ?? false,
      input.published ?? true,
      input.processingStatus ?? 'pending',
      input.createdBy ?? null,
    ],
  );

  return row!;
}

export async function setProcessingStatus(
  id: string,
  status: TourRow['processing_status'],
  error?: string | null,
): Promise<void> {
  await query(
    `UPDATE virtual_tours SET processing_status = $2, processing_error = $3 WHERE id = $1`,
    [id, status, error ?? null],
  );
}

export async function remove(id: string): Promise<TourRow | null> {
  return queryOne<TourRow>(
    `DELETE FROM virtual_tours WHERE id = $1 RETURNING ${COLUMNS}`,
    [id],
  );
}

/**
 * Increments the view counter without blocking the response.
 *
 * A plain UPDATE takes a row lock, so a popular tour would serialise every
 * concurrent viewer behind one row. Counting in Redis and flushing
 * periodically would be the next step if this ever shows up in profiling; at
 * Phase 1 traffic the single-row update is fine and keeps the count durable.
 */
export async function incrementViewCount(id: string): Promise<void> {
  await query(`UPDATE virtual_tours SET view_count = view_count + 1 WHERE id = $1`, [id]);
}
