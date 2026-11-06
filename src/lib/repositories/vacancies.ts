import { query, queryOne, transaction } from '../db';
import type { SalaryPeriod, VacancyType, WorkPattern } from '../careers';
import type { CreateVacancyBody, Salary, UpdateVacancyBody } from '../schemas/careers';
import { slugify, uniqueSlug } from '../slug';

/**
 * Vacancy persistence (db/migrations/0022).
 *
 * Rows are mapped to their API shape here, as documents.ts does. Public reads
 * return published vacancies only; "open" further means its closing date, in
 * West Africa Time, has not passed. The list and `/api/vacancies` show open
 * vacancies only. A vacancy's own page shows a closed one too, saying it has
 * closed, so a link shared last month does not land on a 404.
 */

interface VacancyRow {
  id: string;
  title: string;
  slug: string;
  employment_type: VacancyType;
  department: string | null;
  location: string;
  work_pattern: WorkPattern | null;
  summary: string;
  description: string | null;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  salary_min: string | null;
  salary_max: string | null;
  salary_currency: string;
  salary_period: SalaryPeriod | null;
  closing_date: string | null;
  is_open: boolean;
  published: boolean;
  first_published_at: Date | null;
  sort_order: number;
  application_count?: number;
  new_application_count?: number;
  created_at: Date;
  updated_at: Date;
}

/** Applications are taken through the whole of the closing day, WAT. */
const OPEN = `(v.closing_date IS NULL OR v.closing_date >= (NOW() AT TIME ZONE 'Africa/Lagos')::date)`;

const SELECT = `
  SELECT v.id, v.title, v.slug, v.employment_type, v.department, v.location, v.work_pattern,
         v.summary, v.description, v.responsibilities, v.requirements, v.benefits,
         v.salary_min::text AS salary_min, v.salary_max::text AS salary_max, v.salary_currency,
         v.salary_period, to_char(v.closing_date, 'YYYY-MM-DD') AS closing_date,
         ${OPEN} AS is_open, v.published, v.first_published_at, v.sort_order,
         v.created_at, v.updated_at
    FROM vacancies v
`;

const ORDER = 'v.sort_order ASC, v.title ASC';

/** A vacancy as `/api/vacancies`, `/careers` and its own page show it. */
export interface PublicVacancy {
  id: string;
  title: string;
  slug: string;
  type: VacancyType;
  department: string | null;
  location: string;
  workPattern: WorkPattern | null;
  summary: string;
  description: string | null;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  /** Null unless the vacancy publishes a salary. */
  salary: Salary | null;
  /** YYYY-MM-DD, the last day applications are taken (WAT); null is "open until filled". */
  closingDate: string | null;
  /** Whether it is still taking applications. */
  isOpen: boolean;
  /** When it was first published; JobPosting's datePosted. */
  postedAt: string | null;
}

export interface AdminVacancy extends PublicVacancy {
  published: boolean;
  sortOrder: number;
  /** Every application held for it, spam included. */
  applicationCount: number;
  /** Applications nobody has moved on from "new" yet, spam excluded. */
  newApplicationCount: number;
  createdAt: string;
  updatedAt: string;
}

function salaryFrom(row: VacancyRow): Salary | null {
  if (!row.salary_period || (row.salary_min === null && row.salary_max === null)) return null;
  return {
    min: row.salary_min === null ? null : Number(row.salary_min),
    max: row.salary_max === null ? null : Number(row.salary_max),
    currency: row.salary_currency,
    period: row.salary_period,
  };
}

function toPublic(row: VacancyRow): PublicVacancy {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.employment_type,
    department: row.department,
    location: row.location,
    workPattern: row.work_pattern,
    summary: row.summary,
    description: row.description,
    responsibilities: row.responsibilities,
    requirements: row.requirements,
    benefits: row.benefits,
    salary: salaryFrom(row),
    closingDate: row.closing_date,
    isOpen: row.is_open,
    postedAt: row.first_published_at ? row.first_published_at.toISOString() : null,
  };
}

function toAdmin(row: VacancyRow): AdminVacancy {
  return {
    ...toPublic(row),
    published: row.published,
    sortOrder: row.sort_order,
    applicationCount: Number(row.application_count ?? 0),
    newApplicationCount: Number(row.new_application_count ?? 0),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/* ---------------------------------------------------------------- public */

/** Published vacancies still taking applications, in editorial order. */
export async function listOpen(): Promise<PublicVacancy[]> {
  const { rows } = await query<VacancyRow>(`${SELECT} WHERE v.published AND ${OPEN} ORDER BY ${ORDER}`);
  return rows.map(toPublic);
}

/** A published vacancy by slug, open or closed; null for a draft or none. */
export async function findPublishedBySlug(slug: string): Promise<PublicVacancy | null> {
  const row = await queryOne<VacancyRow>(`${SELECT} WHERE v.slug = $1 AND v.published`, [slug]);
  return row ? toPublic(row) : null;
}

/** Slugs of every published vacancy, open or closed, for the pages to prerender. */
export async function publishedSlugs(): Promise<string[]> {
  const { rows } = await query<{ slug: string }>(`SELECT v.slug FROM vacancies v WHERE v.published ORDER BY ${ORDER}`);
  return rows.map((row) => row.slug);
}

/** What the application route needs to know about the vacancy an application names. */
export async function findForApplication(
  id: string,
): Promise<{ id: string; title: string; isOpen: boolean; closingDate: string | null } | null> {
  const row = await queryOne<VacancyRow>(`${SELECT} WHERE v.id = $1 AND v.published`, [id]);
  return row ? { id: row.id, title: row.title, isOpen: row.is_open, closingDate: row.closing_date } : null;
}

/* ----------------------------------------------------------------- admin */

const COUNTS = `
  (SELECT count(*)::int FROM job_applications a WHERE a.vacancy_id = x.id) AS application_count,
  (SELECT count(*)::int FROM job_applications a
    WHERE a.vacancy_id = x.id AND a.status = 'new' AND NOT a.flagged_as_spam) AS new_application_count
`;

/** Every vacancy, drafts and closed ones included, in display order, with application counts. */
export async function listAll(): Promise<AdminVacancy[]> {
  const { rows } = await query<VacancyRow>(
    `SELECT x.*, ${COUNTS} FROM (${SELECT}) x ORDER BY x.sort_order ASC, x.title ASC`,
  );
  return rows.map(toAdmin);
}

export async function findById(id: string): Promise<AdminVacancy | null> {
  const row = await queryOne<VacancyRow>(`SELECT x.*, ${COUNTS} FROM (${SELECT} WHERE v.id = $1) x`, [id]);
  return row ? toAdmin(row) : null;
}

export type CreateVacancyInput = CreateVacancyBody & { createdBy: string | null };

/** Fields the writes accept, against the column each one sets. Salary is spread over four. */
const COLUMN_FOR: Record<Exclude<keyof UpdateVacancyBody, 'salary'>, string> = {
  title: 'title',
  slug: 'slug',
  type: 'employment_type',
  department: 'department',
  location: 'location',
  workPattern: 'work_pattern',
  summary: 'summary',
  description: 'description',
  responsibilities: 'responsibilities',
  requirements: 'requirements',
  benefits: 'benefits',
  closingDate: 'closing_date',
  published: 'published',
};

function salaryColumns(salary: Salary | null): Record<string, unknown> {
  return {
    salary_min: salary?.min ?? null,
    salary_max: salary?.max ?? null,
    salary_currency: salary?.currency ?? 'NGN',
    salary_period: salary?.period ?? null,
  };
}

/**
 * Creates a vacancy at the end of the list. The slug is made from the title
 * when none is given, and suffixed (`-2`) if it is already taken.
 */
export async function create(input: CreateVacancyInput): Promise<AdminVacancy> {
  const slug = await uniqueSlug('vacancies', input.slug ?? slugify(input.title));
  const salary = salaryColumns(input.salary);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO vacancies (
       title, slug, employment_type, department, location, work_pattern, summary, description,
       responsibilities, requirements, benefits, salary_min, salary_max, salary_currency, salary_period,
       closing_date, published, first_published_at, created_by, sort_order
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
       CASE WHEN $17 THEN NOW() END, $18,
       (SELECT coalesce(max(sort_order), 0) + 10 FROM vacancies)
     )
     RETURNING id`,
    [
      input.title,
      slug,
      input.type,
      input.department,
      input.location,
      input.workPattern,
      input.summary,
      input.description,
      input.responsibilities,
      input.requirements,
      input.benefits,
      salary.salary_min,
      salary.salary_max,
      salary.salary_currency,
      salary.salary_period,
      input.closingDate,
      input.published,
      input.createdBy,
    ],
  );

  return (await findById(row!.id))!;
}

/** Applies the fields present in `input`. Returns null when the vacancy does not exist. */
export async function update(id: string, input: UpdateVacancyBody): Promise<AdminVacancy | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];
  const assign = (column: string, value: unknown) => {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  };

  for (const [field, column] of Object.entries(COLUMN_FOR)) {
    const value = (input as Record<string, unknown>)[field];
    if (value !== undefined) assign(column, value);
  }
  if (input.salary !== undefined) {
    for (const [column, value] of Object.entries(salaryColumns(input.salary))) assign(column, value);
  }
  // The first publication is the advert's date; a later republish keeps it.
  if (input.published === true) assignments.push('first_published_at = coalesce(first_published_at, NOW())');

  if (assignments.length === 0) return findById(id);

  params.push(id);
  const { rowCount } = await query(
    `UPDATE vacancies SET ${assignments.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return rowCount === 0 ? null : findById(id);
}

/**
 * Deletes a vacancy that has no applications. Returns `has-applications`,
 * changing nothing, when it has some: they would otherwise lose the role they
 * were sent for (the foreign key is RESTRICT).
 */
export async function remove(
  id: string,
): Promise<{ id: string; title: string; slug: string } | 'has-applications' | null> {
  return transaction(async (client) => {
    const { rows } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM job_applications WHERE vacancy_id = $1`,
      [id],
    );
    if ((rows[0]?.n ?? 0) > 0) return 'has-applications';

    const deleted = await client.query<{ id: string; title: string; slug: string }>(
      `DELETE FROM vacancies WHERE id = $1 RETURNING id, title, slug`,
      [id],
    );
    return deleted.rows[0] ?? null;
  });
}

/**
 * Sets the display order to the order of `ids`, which must name every vacancy
 * exactly once. Returns false, changing nothing, when it does not.
 */
export async function reorder(ids: readonly string[]): Promise<boolean> {
  return transaction(async (client) => {
    // Locks the rows so a vacancy created mid-reorder waits for this to finish.
    const { rows } = await client.query<{ id: string }>(`SELECT id FROM vacancies FOR UPDATE`);
    const existing = new Set(rows.map((row) => row.id));
    if (existing.size !== ids.length || !ids.every((id) => existing.has(id))) return false;

    await client.query(
      `UPDATE vacancies v SET sort_order = o.position * 10
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position)
        WHERE v.id = o.id`,
      [ids],
    );
    return true;
  });
}
