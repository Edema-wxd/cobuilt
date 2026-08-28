import { query, queryOne } from '../db';
import type { MilestoneRow, MilestoneStatus } from '@/types/models';
import type { CreateMilestoneBody, UpdateMilestoneBody } from '../schemas/passport';

/** Project Passport(TM) milestone persistence. */

const COLUMNS = `
  id, project_id, milestone_type, title, description,
  scheduled_date, actual_date, status, sort_order,
  photo_urls, document_urls, video_url, is_public,
  triggered_at, updated_at, created_by, meta_title, meta_description
`;

export async function listForProject(
  projectId: string,
  options: { includeInternal?: boolean; status?: MilestoneStatus } = {},
): Promise<MilestoneRow[]> {
  const conditions = ['project_id = $1'];
  const params: unknown[] = [projectId];

  if (!options.includeInternal) conditions.push('is_public = TRUE');

  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }

  const { rows } = await query<MilestoneRow>(
    `SELECT ${COLUMNS} FROM passport_milestones
      WHERE ${conditions.join(' AND ')}
      ORDER BY sort_order ASC, coalesce(actual_date, scheduled_date) ASC NULLS LAST, triggered_at ASC`,
    params,
  );

  return rows;
}

export async function findById(id: string): Promise<MilestoneRow | null> {
  return queryOne<MilestoneRow>(
    `SELECT ${COLUMNS} FROM passport_milestones WHERE id = $1`,
    [id],
  );
}

export async function create(
  projectId: string,
  input: CreateMilestoneBody,
  createdBy: string | null,
): Promise<MilestoneRow> {
  const row = await queryOne<MilestoneRow>(
    `INSERT INTO passport_milestones (
       project_id, milestone_type, title, description,
       scheduled_date, actual_date, status, sort_order,
       photo_urls, document_urls, video_url, is_public,
       meta_title, meta_description, created_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       -- Append to the end of the timeline unless an order is given.
       coalesce($8::int, (SELECT coalesce(max(sort_order), 0) + 1
                            FROM passport_milestones WHERE project_id = $1)),
       $9, $10, $11, $12,
       $13, $14, $15
     ) RETURNING ${COLUMNS}`,
    [
      projectId,
      input.milestoneType,
      input.title ?? null,
      input.description ?? null,
      input.scheduledDate ?? null,
      input.actualDate ?? null,
      input.status,
      input.sortOrder ?? null,
      input.photoUrls ?? [],
      input.documentUrls ?? [],
      input.videoUrl ?? null,
      input.isPublic ?? true,
      input.metaTitle ?? null,
      input.metaDescription ?? null,
      createdBy,
    ],
  );

  return row!;
}

const UPDATABLE_COLUMNS: Record<string, string> = {
  milestoneType: 'milestone_type',
  title: 'title',
  description: 'description',
  scheduledDate: 'scheduled_date',
  actualDate: 'actual_date',
  status: 'status',
  sortOrder: 'sort_order',
  photoUrls: 'photo_urls',
  documentUrls: 'document_urls',
  videoUrl: 'video_url',
  isPublic: 'is_public',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
};

export async function update(
  id: string,
  input: UpdateMilestoneBody,
): Promise<MilestoneRow | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return findById(id);

  params.push(id);
  const row = await queryOne<MilestoneRow>(
    `UPDATE passport_milestones SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING ${COLUMNS}`,
    params,
  );

  return row;
}

export async function remove(id: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM passport_milestones WHERE id = $1`, [id]);
  return rowCount > 0;
}

/**
 * Completion percentage for a project's public timeline, shown on the project
 * card without the frontend having to fetch and count milestones itself.
 */
export async function progressForProject(projectId: string): Promise<{
  total: number;
  completed: number;
  percentComplete: number;
  nextMilestone: { title: string | null; type: string; scheduledDate: Date | null } | null;
}> {
  const summary = await queryOne<{ total: string; completed: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE status = 'completed')::text AS completed
       FROM passport_milestones
      WHERE project_id = $1 AND is_public = TRUE`,
    [projectId],
  );

  const next = await queryOne<{
    title: string | null;
    milestone_type: string;
    scheduled_date: Date | null;
  }>(
    `SELECT title, milestone_type, scheduled_date
       FROM passport_milestones
      WHERE project_id = $1 AND is_public = TRUE AND status <> 'completed'
      ORDER BY sort_order ASC, scheduled_date ASC NULLS LAST
      LIMIT 1`,
    [projectId],
  );

  const total = Number(summary?.total ?? 0);
  const completed = Number(summary?.completed ?? 0);

  return {
    total,
    completed,
    percentComplete: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextMilestone: next
      ? { title: next.title, type: next.milestone_type, scheduledDate: next.scheduled_date }
      : null,
  };
}
