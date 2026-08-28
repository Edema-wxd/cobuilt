import { query, queryOne } from '../db';
import { env } from '../env';
import type { FormSubmissionRow, Paginated } from '@/types/models';
import { paginate } from '@/types/models';

/** Form submission capture and moderation. */

export type FormType = 'inquiry' | 'newsletter' | 'investment';

const COLUMNS = `
  id, form_type, name, email, phone, message, metadata, host(ip_address) AS ip_address,
  user_agent, spam_score::text AS spam_score, flagged_as_spam, submitted_at,
  processed, processed_at, retain_until, anonymised_at
`;

/**
 * NDPA retention (§11): inquiries are kept 90 days, investment inquiries 2
 * years. Computing the deadline at write time means the purge job never has to
 * re-derive policy, and a policy change does not retroactively delete data
 * captured under the old one.
 */
export function retentionDeadline(formType: FormType): Date {
  const days =
    formType === 'investment'
      ? env.RETENTION_INVESTOR_INQUIRY_DAYS
      : env.RETENTION_FORM_SUBMISSION_DAYS;

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export interface CreateSubmissionInput {
  formType: FormType;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  spamScore?: number | null;
  flaggedAsSpam?: boolean;
}

export async function create(input: CreateSubmissionInput): Promise<FormSubmissionRow> {
  const row = await queryOne<FormSubmissionRow>(
    `INSERT INTO form_submissions (
       form_type, name, email, phone, message, metadata,
       ip_address, user_agent, spam_score, flagged_as_spam, retain_until
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${COLUMNS}`,
    [
      input.formType,
      input.name ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.message ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.spamScore ?? null,
      input.flaggedAsSpam ?? false,
      retentionDeadline(input.formType),
    ],
  );

  return row!;
}

export interface ListSubmissionsOptions {
  formType?: FormType;
  flaggedAsSpam?: boolean;
  processed?: boolean;
  page: number;
  pageSize: number;
}

export async function list(
  options: ListSubmissionsOptions,
): Promise<Paginated<FormSubmissionRow>> {
  const conditions: string[] = ['1 = 1'];
  const params: unknown[] = [];

  if (options.formType) {
    params.push(options.formType);
    conditions.push(`form_type = $${params.length}`);
  }
  if (options.flaggedAsSpam !== undefined) {
    params.push(options.flaggedAsSpam);
    conditions.push(`flagged_as_spam = $${params.length}`);
  }
  if (options.processed !== undefined) {
    params.push(options.processed);
    conditions.push(`processed = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize, offset);

  const { rows } = await query<FormSubmissionRow>(
    `SELECT ${COLUMNS} FROM form_submissions ${where}
      ORDER BY submitted_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM form_submissions ${where}`,
    params.slice(0, -2),
  );

  return paginate(rows, Number(total?.count ?? 0), options.page, options.pageSize);
}

export async function findById(id: string): Promise<FormSubmissionRow | null> {
  return queryOne<FormSubmissionRow>(
    `SELECT ${COLUMNS} FROM form_submissions WHERE id = $1`,
    [id],
  );
}

export async function setSpamFlag(
  id: string,
  flagged: boolean,
  actorId: string,
): Promise<FormSubmissionRow | null> {
  return queryOne<FormSubmissionRow>(
    `UPDATE form_submissions
        SET flagged_as_spam = $2, processed = TRUE, processed_at = NOW(), processed_by = $3
      WHERE id = $1
      RETURNING ${COLUMNS}`,
    [id, flagged, actorId],
  );
}

export async function markProcessed(id: string, actorId: string): Promise<void> {
  await query(
    `UPDATE form_submissions
        SET processed = TRUE, processed_at = NOW(), processed_by = $2
      WHERE id = $1`,
    [id, actorId],
  );
}

/**
 * Anonymises submissions past their retention deadline.
 *
 * The row itself is kept — deleting it would distort the historical enquiry
 * counts the analytics endpoint reports — but every field that identifies a
 * person is cleared.
 */
export async function purgeExpired(): Promise<number> {
  const { rowCount } = await query(
    `UPDATE form_submissions
        SET name = NULL, email = NULL, phone = NULL, message = NULL,
            ip_address = NULL, user_agent = NULL, metadata = '{}'::jsonb,
            anonymised_at = NOW()
      WHERE retain_until < NOW() AND anonymised_at IS NULL`,
  );
  return rowCount;
}

/** Clears personal data for one subject on request (NDPA erasure, §11). */
export async function anonymiseByEmail(email: string): Promise<number> {
  const { rowCount } = await query(
    `UPDATE form_submissions
        SET name = NULL, email = NULL, phone = NULL, message = NULL,
            ip_address = NULL, user_agent = NULL, metadata = '{}'::jsonb,
            anonymised_at = NOW()
      WHERE lower(email) = lower($1) AND anonymised_at IS NULL`,
    [email],
  );
  return rowCount;
}
