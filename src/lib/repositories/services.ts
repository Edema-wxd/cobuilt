import { query, queryOne, transaction } from '../db';
import type { ProjectStatus } from '@/types/models';
import type {
  CreateServiceBody,
  SetServiceProjectsBody,
  UpdateServiceBody,
} from '../schemas/services';
import { slugify, uniqueSlug } from '../slug';

/**
 * Service page persistence.
 *
 * `services` is also the project taxonomy table (db/migrations/0015), so its
 * `name` is the page title and `description` the one-line summary. Rows are
 * mapped to their API shape here rather than in serializers.ts: nothing reads
 * a raw service row, and the column names that differ from the API's would
 * otherwise leak into every caller.
 *
 * Public reads return published rows only; the admin reads return every row.
 */

export interface ServiceStep {
  title: string;
  body: string;
}

interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  standfirst: string;
  body: string[];
  covers: string[];
  deliverables: string[];
  suited_to: string[];
  process: ServiceStep[];
  benefits: ServiceStep[];
  informational: boolean;
  sort_order: number;
  published: boolean;
  meta_title: string | null;
  meta_description: string | null;
  created_at: Date;
  updated_at: Date;
  project_count?: number;
}

const COLUMNS = `
  s.id, s.slug, s.name, s.description, s.standfirst, s.body, s.covers,
  s.deliverables, s.suited_to, s.process, s.benefits, s.informational,
  s.sort_order, s.published, s.meta_title, s.meta_description,
  s.created_at, s.updated_at
`;

const ORDER = 's.sort_order ASC, s.name ASC';

/** A service as the public site and `/api/services/[slug]` show it. */
export interface PublicService {
  id: string;
  slug: string;
  title: string;
  summary: string;
  standfirst: string;
  body: string[];
  covers: string[];
  deliverables: string[];
  suitedTo: string[];
  process: ServiceStep[];
  benefits: ServiceStep[];
  informational: boolean;
  seo: { metaTitle: string | null; metaDescription: string | null };
}

/** The services index card and `/api/services`. */
export type ServiceSummary = Pick<PublicService, 'id' | 'slug' | 'title' | 'summary' | 'informational'>;

export interface AdminService extends PublicService {
  published: boolean;
  sortOrder: number;
  /** Projects shown on the page, published or not; set on list reads only. */
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** A project shown on a service page. */
export interface ServiceProject {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  location: string | null;
  featuredImageUrl: string | null;
  caseStudy: boolean;
}

export interface AdminServiceProject extends ServiceProject {
  /** A draft or scheduled project is kept on the list but left off the page. */
  isPublished: boolean;
}

function toPublic(row: ServiceRow): PublicService {
  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    summary: row.description ?? '',
    standfirst: row.standfirst,
    body: row.body ?? [],
    covers: row.covers ?? [],
    deliverables: row.deliverables ?? [],
    suitedTo: row.suited_to ?? [],
    process: row.process ?? [],
    benefits: row.benefits ?? [],
    informational: row.informational,
    seo: { metaTitle: row.meta_title, metaDescription: row.meta_description },
  };
}

function toAdmin(row: ServiceRow): AdminService {
  return {
    ...toPublic(row),
    published: row.published,
    sortOrder: row.sort_order,
    ...(row.project_count === undefined ? {} : { projectCount: Number(row.project_count) }),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/* ---------------------------------------------------------------- public */

export async function listPublished(): Promise<ServiceSummary[]> {
  const { rows } = await query<ServiceRow>(
    `SELECT ${COLUMNS} FROM services s WHERE s.published ORDER BY ${ORDER}`,
  );
  return rows.map((row) => {
    const { id, slug, title, summary, informational } = toPublic(row);
    return { id, slug, title, summary, informational };
  });
}

export async function findPublishedBySlug(slug: string): Promise<PublicService | null> {
  const row = await queryOne<ServiceRow>(
    `SELECT ${COLUMNS} FROM services s WHERE s.slug = $1 AND s.published`,
    [slug],
  );
  return row ? toPublic(row) : null;
}

interface ServiceProjectRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  location_name: string | null;
  featured_image_url: string | null;
  is_case_study: boolean;
  is_published: boolean;
}

const LIVE_PROJECT = 'p.published_at IS NOT NULL AND p.published_at <= NOW()';

async function projectRows(serviceId: string, publishedOnly: boolean): Promise<ServiceProjectRow[]> {
  const { rows } = await query<ServiceProjectRow>(
    `SELECT p.id, p.slug, p.title, p.description, p.status, p.featured_image_url,
            l.name AS location_name, sp.is_case_study,
            (${LIVE_PROJECT}) AS is_published
       FROM service_projects sp
       JOIN projects p ON p.id = sp.project_id AND p.deleted_at IS NULL
       LEFT JOIN locations l ON l.id = p.location_id
      WHERE sp.service_id = $1 ${publishedOnly ? `AND ${LIVE_PROJECT}` : ''}
      ORDER BY sp.sort_order ASC, p.title ASC`,
    [serviceId],
  );
  return rows;
}

function toServiceProject(row: ServiceProjectRow): ServiceProject {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    location: row.location_name,
    featuredImageUrl: row.featured_image_url,
    caseStudy: row.is_case_study,
  };
}

/**
 * The live projects on a service page, split the way the page shows them:
 * case studies first, then the other related projects. Drafts, scheduled and
 * deleted projects are left out.
 */
export async function publishedProjectsFor(
  serviceId: string,
): Promise<{ caseStudies: ServiceProject[]; relatedProjects: ServiceProject[] }> {
  const projects = (await projectRows(serviceId, true)).map(toServiceProject);
  return {
    caseStudies: projects.filter((project) => project.caseStudy),
    relatedProjects: projects.filter((project) => !project.caseStudy),
  };
}

/* ----------------------------------------------------------------- admin */

export async function listAll(): Promise<AdminService[]> {
  const { rows } = await query<ServiceRow>(
    `SELECT ${COLUMNS},
            (SELECT count(*)::int FROM service_projects sp WHERE sp.service_id = s.id) AS project_count
       FROM services s
      ORDER BY ${ORDER}`,
  );
  return rows.map(toAdmin);
}

export async function findById(id: string): Promise<AdminService | null> {
  const row = await queryOne<ServiceRow>(`SELECT ${COLUMNS} FROM services s WHERE s.id = $1`, [id]);
  return row ? toAdmin(row) : null;
}

export async function projectsFor(serviceId: string): Promise<AdminServiceProject[]> {
  return (await projectRows(serviceId, false)).map((row) => ({
    ...toServiceProject(row),
    isPublished: row.is_published,
  }));
}

/** Fields the write API accepts, against the column each one sets. */
const COLUMN_FOR: Record<keyof Omit<UpdateServiceBody, 'process' | 'benefits'>, string> = {
  title: 'name',
  slug: 'slug',
  summary: 'description',
  standfirst: 'standfirst',
  body: 'body',
  covers: 'covers',
  deliverables: 'deliverables',
  suitedTo: 'suited_to',
  informational: 'informational',
  published: 'published',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
};

/**
 * Creates a service at the end of the list. The slug is made from the title
 * when none is given, and suffixed (`-2`) if it is already taken.
 */
export async function create(input: CreateServiceBody): Promise<AdminService> {
  const slug = await uniqueSlug('services', input.slug ?? slugify(input.title));

  const row = await queryOne<{ id: string }>(
    `INSERT INTO services (
       name, slug, description, standfirst, body, covers, deliverables, suited_to,
       process, benefits, informational, published, meta_title, meta_description, sort_order
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14,
       (SELECT coalesce(max(sort_order), 0) + 10 FROM services)
     )
     RETURNING id`,
    [
      input.title,
      slug,
      input.summary,
      input.standfirst,
      input.body,
      input.covers,
      input.deliverables,
      input.suitedTo,
      JSON.stringify(input.process),
      JSON.stringify(input.benefits),
      input.informational,
      input.published,
      input.metaTitle,
      input.metaDescription,
    ],
  );

  return (await findById(row!.id))!;
}

/** Applies the fields present in `input`. Returns null when the service does not exist. */
export async function update(id: string, input: UpdateServiceBody): Promise<AdminService | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(COLUMN_FOR)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }
  for (const field of ['process', 'benefits'] as const) {
    if (input[field] === undefined) continue;
    params.push(JSON.stringify(input[field]));
    assignments.push(`${field} = $${params.length}::jsonb`);
  }

  if (assignments.length === 0) return findById(id);

  params.push(id);
  const { rowCount } = await query(
    `UPDATE services SET ${assignments.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return rowCount === 0 ? null : findById(id);
}

/**
 * Deletes a service and everything that points at it: its page projects (by
 * cascade) and its tag on any project, which is an array with no foreign key
 * to cascade through. Returns the removed row, or null if there was none.
 */
export async function remove(id: string): Promise<{ id: string; title: string; slug: string } | null> {
  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string; name: string; slug: string }>(
      `DELETE FROM services WHERE id = $1 RETURNING id, name, slug`,
      [id],
    );
    const removed = rows[0];
    if (!removed) return null;

    await client.query(
      `UPDATE projects SET service_ids = array_remove(service_ids, $1::uuid)
        WHERE $1::uuid = ANY(service_ids)`,
      [id],
    );
    return { id: removed.id, title: removed.name, slug: removed.slug };
  });
}

/**
 * Sets the display order to the order of `ids`, which must name every service
 * exactly once. Returns false, changing nothing, when it does not — a list
 * reordered from a stale screen would otherwise drop or misplace a service
 * added in the meantime.
 */
export async function reorder(ids: readonly string[]): Promise<boolean> {
  return transaction(async (client) => {
    // Locks the rows so a service created mid-reorder waits for this to finish.
    const { rows } = await client.query<{ id: string }>(`SELECT id FROM services FOR UPDATE`);
    const existing = new Set(rows.map((row) => row.id));
    if (existing.size !== ids.length || !ids.every((id) => existing.has(id))) return false;

    await client.query(
      `UPDATE services s SET sort_order = o.position * 10
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position)
        WHERE s.id = o.id`,
      [ids],
    );
    return true;
  });
}

/**
 * Replaces the projects shown on a service page. Every project must exist and
 * not be deleted; the ids that do not are returned and nothing is changed.
 */
export async function setProjects(
  serviceId: string,
  projects: SetServiceProjectsBody['projects'],
): Promise<{ missing: string[] }> {
  const ids = projects.map((project) => project.projectId);

  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM projects WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [ids],
    );
    const found = new Set(rows.map((row) => row.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) return { missing };

    await client.query(`DELETE FROM service_projects WHERE service_id = $1`, [serviceId]);
    if (projects.length > 0) {
      await client.query(
        `INSERT INTO service_projects (service_id, project_id, is_case_study, sort_order)
         SELECT $1, o.project_id, o.case_study, o.position * 10
           FROM unnest($2::uuid[], $3::boolean[]) WITH ORDINALITY AS o(project_id, case_study, position)`,
        [serviceId, ids, projects.map((project) => project.caseStudy)],
      );
    }
    return { missing: [] };
  });
}
