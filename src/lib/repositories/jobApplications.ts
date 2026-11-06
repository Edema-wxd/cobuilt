import { query, queryOne, transaction } from '../db';
import { env } from '../env';
import { maskEmail, maskPhone } from '../privacy';
import type { ApplicationStatus } from '../careers';
import type { CheckedCv } from '../storage/cvFiles';
import type { UpdateApplicationBody } from '../schemas/careers';
import type { Paginated } from '@/types/models';
import { paginate } from '@/types/models';

/**
 * Job application persistence (db/migrations/0022).
 *
 * The CV's bytes live in `job_application_cvs` and are read by `readCv` alone,
 * for the authenticated download; every other read here leaves them out. The
 * inbox list masks contact details, as the form inbox does (§2.8); the detail
 * read shows them, and the route audits it.
 *
 * An application is deleted, not anonymised, when its retention deadline
 * passes or its subject asks for erasure: without the person and their CV
 * there is nothing left worth keeping (docs/decisions.md §2.28).
 */

interface ApplicationRow {
  id: string;
  vacancy_id: string | null;
  vacancy_title: string | null;
  vacancy_slug: string | null;
  name: string;
  email: string;
  phone: string | null;
  cover_note: string | null;
  cv_file_name: string;
  cv_content_type: string;
  cv_size_bytes: number;
  status: ApplicationStatus;
  staff_notes: string | null;
  spam_score: string | null;
  flagged_as_spam: boolean;
  created_at: Date;
  updated_at: Date;
  retain_until: Date;
}

const SELECT = `
  SELECT a.id, a.vacancy_id, v.title AS vacancy_title, v.slug AS vacancy_slug,
         a.name, a.email, a.phone, a.cover_note, a.cv_file_name, a.cv_content_type, a.cv_size_bytes,
         a.status, a.staff_notes, a.spam_score::text AS spam_score, a.flagged_as_spam,
         a.created_at, a.updated_at, a.retain_until
    FROM job_applications a
    LEFT JOIN vacancies v ON v.id = a.vacancy_id
`;

/** An application as the inbox lists it: contact details masked, no cover note. */
export interface ApplicationSummary {
  id: string;
  /** Null for a speculative application. */
  vacancy: { id: string; title: string; slug: string } | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: ApplicationStatus;
  flaggedAsSpam: boolean;
  cv: { fileName: string; contentType: string; sizeBytes: number };
  createdAt: string;
  retainUntil: string;
}

/** One application, opened: the contact details in full, the note and the staff notes. */
export interface ApplicationDetail extends ApplicationSummary {
  email: string;
  phone: string | null;
  coverNote: string | null;
  staffNotes: string | null;
  spamScore: number | null;
  updatedAt: string;
}

function toSummary(row: ApplicationRow): ApplicationSummary {
  return {
    id: row.id,
    vacancy:
      row.vacancy_id && row.vacancy_title && row.vacancy_slug
        ? { id: row.vacancy_id, title: row.vacancy_title, slug: row.vacancy_slug }
        : null,
    name: row.name,
    email: maskEmail(row.email),
    phone: maskPhone(row.phone),
    status: row.status,
    flaggedAsSpam: row.flagged_as_spam,
    cv: { fileName: row.cv_file_name, contentType: row.cv_content_type, sizeBytes: row.cv_size_bytes },
    createdAt: row.created_at.toISOString(),
    retainUntil: row.retain_until.toISOString(),
  };
}

function toDetail(row: ApplicationRow): ApplicationDetail {
  return {
    ...toSummary(row),
    email: row.email,
    phone: row.phone,
    coverNote: row.cover_note,
    staffNotes: row.staff_notes,
    spamScore: row.spam_score === null ? null : Number(row.spam_score),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** NDPA retention (§2.4): the deadline is fixed when the application arrives. */
export function retentionDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + env.RETENTION_JOB_APPLICATION_DAYS * 24 * 60 * 60 * 1000);
}

export interface CreateApplicationInput {
  vacancyId: string | null;
  name: string;
  email: string;
  phone: string | null;
  coverNote: string | null;
  cv: CheckedCv & { bytes: Uint8Array };
  spamScore: number | null;
  flaggedAsSpam: boolean;
}

/** Stores the application and its CV together, or neither. */
export async function create(input: CreateApplicationInput): Promise<{ id: string; retainUntil: string }> {
  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string; retain_until: Date }>(
      `INSERT INTO job_applications (
         vacancy_id, name, email, phone, cover_note, cv_file_name, cv_content_type, cv_size_bytes,
         spam_score, flagged_as_spam, retain_until
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, retain_until`,
      [
        input.vacancyId,
        input.name,
        input.email,
        input.phone,
        input.coverNote,
        input.cv.fileName,
        input.cv.contentType,
        input.cv.sizeBytes,
        input.spamScore,
        input.flaggedAsSpam,
        retentionDeadline(),
      ],
    );
    const row = rows[0]!;
    await client.query(`INSERT INTO job_application_cvs (application_id, content) VALUES ($1, $2)`, [
      row.id,
      Buffer.from(input.cv.bytes),
    ]);
    return { id: row.id, retainUntil: row.retain_until.toISOString() };
  });
}

export interface ListApplicationsOptions {
  /** A vacancy's id, or `speculative`. */
  vacancy?: string;
  status?: ApplicationStatus;
  flaggedAsSpam?: boolean;
  page: number;
  pageSize: number;
}

export async function list(options: ListApplicationsOptions): Promise<Paginated<ApplicationSummary>> {
  const conditions: string[] = ['1 = 1'];
  const params: unknown[] = [];

  if (options.vacancy === 'speculative') {
    conditions.push('a.vacancy_id IS NULL');
  } else if (options.vacancy) {
    params.push(options.vacancy);
    conditions.push(`a.vacancy_id = $${params.length}`);
  }
  if (options.status) {
    params.push(options.status);
    conditions.push(`a.status = $${params.length}`);
  }
  if (options.flaggedAsSpam !== undefined) {
    params.push(options.flaggedAsSpam);
    conditions.push(`a.flagged_as_spam = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize, offset);

  const { rows } = await query<ApplicationRow>(
    `${SELECT} ${where} ORDER BY a.created_at DESC, a.id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM job_applications a ${where}`,
    params.slice(0, -2),
  );

  return paginate(rows.map(toSummary), Number(total?.count ?? 0), options.page, options.pageSize);
}

export async function findById(id: string): Promise<ApplicationDetail | null> {
  const row = await queryOne<ApplicationRow>(`${SELECT} WHERE a.id = $1`, [id]);
  return row ? toDetail(row) : null;
}

/** The CV's bytes, for the authenticated download only. */
export async function readCv(
  id: string,
): Promise<{ fileName: string; contentType: string; content: Buffer } | null> {
  const row = await queryOne<{ cv_file_name: string; cv_content_type: string; content: Buffer }>(
    `SELECT a.cv_file_name, a.cv_content_type, c.content
       FROM job_applications a JOIN job_application_cvs c ON c.application_id = a.id
      WHERE a.id = $1`,
    [id],
  );
  return row ? { fileName: row.cv_file_name, contentType: row.cv_content_type, content: row.content } : null;
}

const COLUMN_FOR: Record<keyof UpdateApplicationBody, string> = {
  status: 'status',
  staffNotes: 'staff_notes',
  flaggedAsSpam: 'flagged_as_spam',
};

/** Applies the fields present in `input`. Returns null when the application does not exist. */
export async function update(id: string, input: UpdateApplicationBody): Promise<ApplicationDetail | null> {
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
    `UPDATE job_applications SET ${assignments.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return rowCount === 0 ? null : findById(id);
}

/** Deletes an application and its CV. Returns what the audit entry needs, or null if there was none. */
export async function remove(
  id: string,
): Promise<{ id: string; vacancyId: string | null; email: string; phone: string | null } | null> {
  const row = await queryOne<{ id: string; vacancy_id: string | null; email: string; phone: string | null }>(
    `DELETE FROM job_applications WHERE id = $1 RETURNING id, vacancy_id, email, phone`,
    [id],
  );
  return row ? { id: row.id, vacancyId: row.vacancy_id, email: row.email, phone: row.phone } : null;
}

/** The nightly retention purge: deletes applications past their deadline, CVs with them. */
export async function purgeExpired(): Promise<number> {
  const { rowCount } = await query(`DELETE FROM job_applications WHERE retain_until < NOW()`);
  return rowCount;
}
