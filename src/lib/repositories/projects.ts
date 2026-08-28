import { query, queryOne } from '../db';
import type {
  Paginated,
  ProjectRow,
  ProjectStatus,
} from '@/types/models';
import { paginate } from '@/types/models';
import type { CreateProjectBody, UpdateProjectBody } from '../schemas/projects';
import { slugify, uniqueSlug } from '../slug';

/**
 * Project persistence.
 *
 * Every public read filters on `deleted_at IS NULL AND published_at <= NOW()`.
 * Admin reads opt out of that through `includeUnpublished`, which the route
 * only sets for an authenticated editor or admin.
 */

const SELECT_COLUMNS = `
  p.id, p.title, p.slug, p.description, p.long_description,
  p.project_type_id, p.location_id, p.sector_id, p.status,
  p.featured_image_url, p.gallery_ids, p.service_ids, p.tag_ids,
  p.passport_enabled, p.passport_start_date, p.passport_completion_target,
  p.investment_amount, p.expected_roi, p.investor_highlights,
  p.investor_highlights_approved,
  p.meta_title, p.meta_description, p.open_graph_image_url, p.canonical_url,
  p.published_at, p.created_at, p.updated_at, p.deleted_at, p.created_by,
  pt.name AS project_type_name,
  l.name  AS location_name,
  s.name  AS sector_name
`;

const FROM_CLAUSE = `
  FROM projects p
  LEFT JOIN project_types pt ON pt.id = p.project_type_id
  LEFT JOIN locations     l  ON l.id  = p.location_id
  LEFT JOIN sectors       s  ON s.id  = p.sector_id
`;

export interface ListProjectsOptions {
  status?: ProjectStatus;
  type?: string;
  location?: string;
  sector?: string;
  tag?: string;
  q?: string;
  sort?: 'recent' | 'title' | 'oldest';
  page: number;
  pageSize: number;
  includeUnpublished?: boolean;
}

export async function listProjects(
  options: ListProjectsOptions,
): Promise<Paginated<ProjectRow>> {
  const conditions: string[] = ['p.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (!options.includeUnpublished) {
    conditions.push('p.published_at IS NOT NULL', 'p.published_at <= NOW()');
  }

  if (options.status) {
    params.push(options.status);
    conditions.push(`p.status = $${params.length}`);
  }

  // Taxonomy filters accept either the slug or the UUID, so the frontend can
  // build readable URLs (?sector=residential) without a lookup round-trip.
  // The branch is chosen here rather than with an OR in SQL: PostgreSQL still
  // evaluates the ::uuid cast on the unused side of an OR, which raises
  // "invalid input syntax for type uuid" on a slug.
  for (const [column, alias, value] of [
    ['project_type_id', 'pt', options.type],
    ['location_id', 'l', options.location],
    ['sector_id', 's', options.sector],
  ] as const) {
    if (!value) continue;
    params.push(value);
    conditions.push(
      isUuid(value) ? `p.${column} = $${params.length}::uuid` : `${alias}.slug = $${params.length}`,
    );
  }

  if (options.tag) {
    params.push(options.tag);
    conditions.push(
      `p.tag_ids && (SELECT coalesce(array_agg(id), '{}') FROM tags WHERE slug = $${params.length})`,
    );
  }

  if (options.q) {
    params.push(options.q);
    conditions.push(`p.search_vector @@ websearch_to_tsquery('english', $${params.length})`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = ORDER_BY[options.sort ?? 'recent'];

  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize, offset);

  const rows = await query<ProjectRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const countParams = params.slice(0, -2);
  const total = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count ${FROM_CLAUSE} ${where}`,
    countParams,
  );

  return paginate(rows.rows, Number(total?.count ?? 0), options.page, options.pageSize);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

const ORDER_BY = {
  recent: 'p.published_at DESC NULLS LAST, p.created_at DESC',
  oldest: 'p.published_at ASC NULLS LAST, p.created_at ASC',
  title: 'p.title ASC',
} as const;

export async function findBySlug(
  slug: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<ProjectRow | null> {
  const published = options.includeUnpublished
    ? ''
    : 'AND p.published_at IS NOT NULL AND p.published_at <= NOW()';

  return queryOne<ProjectRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE}
      WHERE p.slug = $1 AND p.deleted_at IS NULL ${published}`,
    [slug],
  );
}

export async function findById(
  id: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<ProjectRow | null> {
  const published = options.includeUnpublished
    ? ''
    : 'AND p.published_at IS NOT NULL AND p.published_at <= NOW()';

  return queryOne<ProjectRow>(
    `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE}
      WHERE p.id = $1 AND p.deleted_at IS NULL ${published}`,
    [id],
  );
}

export async function exists(id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return row !== null;
}

export async function create(
  input: CreateProjectBody,
  createdBy: string | null,
): Promise<ProjectRow> {
  const slug = await uniqueSlug('projects', input.slug ?? slugify(input.title));

  const row = await queryOne<{ id: string }>(
    `INSERT INTO projects (
       title, slug, description, long_description,
       project_type_id, location_id, sector_id, status,
       featured_image_url, gallery_ids, service_ids, tag_ids,
       passport_enabled, passport_start_date, passport_completion_target,
       investment_amount, expected_roi, investor_highlights,
       meta_title, meta_description, open_graph_image_url, canonical_url,
       published_at, created_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11, $12,
       $13, $14, $15,
       $16, $17, $18,
       $19, $20, $21, $22,
       $23, $24
     ) RETURNING id`,
    [
      input.title,
      slug,
      input.description ?? null,
      input.longDescription ?? null,
      input.projectTypeId ?? null,
      input.locationId ?? null,
      input.sectorId ?? null,
      input.status,
      input.featuredImageUrl ?? null,
      input.galleryIds ?? [],
      input.serviceIds ?? [],
      input.tagIds ?? [],
      input.passportEnabled ?? true,
      input.passportStartDate ?? null,
      input.passportCompletionTarget ?? null,
      input.investmentAmount ?? null,
      input.expectedRoi ?? null,
      input.investorHighlights ?? null,
      input.metaTitle ?? null,
      input.metaDescription ?? null,
      input.openGraphImageUrl ?? null,
      input.canonicalUrl ?? null,
      input.publishedAt ?? null,
      createdBy,
    ],
  );

  const created = await findById(row!.id, { includeUnpublished: true });
  // The row was just inserted in the same connection pool; a null here would
  // mean the insert silently failed, which RETURNING already rules out.
  return created!;
}

/** Maps API field names to their columns for partial updates. */
const UPDATABLE_COLUMNS: Record<keyof UpdateProjectBody, string> = {
  title: 'title',
  slug: 'slug',
  description: 'description',
  longDescription: 'long_description',
  projectTypeId: 'project_type_id',
  locationId: 'location_id',
  sectorId: 'sector_id',
  status: 'status',
  featuredImageUrl: 'featured_image_url',
  galleryIds: 'gallery_ids',
  serviceIds: 'service_ids',
  tagIds: 'tag_ids',
  passportEnabled: 'passport_enabled',
  passportStartDate: 'passport_start_date',
  passportCompletionTarget: 'passport_completion_target',
  investmentAmount: 'investment_amount',
  expectedRoi: 'expected_roi',
  investorHighlights: 'investor_highlights',
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
  openGraphImageUrl: 'open_graph_image_url',
  canonicalUrl: 'canonical_url',
  publishedAt: 'published_at',
};

export async function update(
  id: string,
  input: UpdateProjectBody,
): Promise<ProjectRow | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  // Editing the investor payload invalidates any prior legal sign-off (§10).
  if (input.investorHighlights !== undefined) {
    assignments.push(
      'investor_highlights_approved = FALSE',
      'investor_highlights_approved_by = NULL',
      'investor_highlights_approved_at = NULL',
    );
  }

  if (assignments.length === 0) return findById(id, { includeUnpublished: true });

  params.push(id);
  await query(
    `UPDATE projects SET ${assignments.join(', ')}
      WHERE id = $${params.length} AND deleted_at IS NULL`,
    params,
  );

  return findById(id, { includeUnpublished: true });
}

/** Soft delete, as the spec prefers (§3). The row stays for audit and restore. */
export async function softDelete(id: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE projects SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rowCount > 0;
}

export async function setInvestorApproval(
  id: string,
  approved: boolean,
  approvedBy: string,
): Promise<ProjectRow | null> {
  await query(
    `UPDATE projects
        SET investor_highlights_approved = $2,
            investor_highlights_approved_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
            investor_highlights_approved_at = CASE WHEN $2 THEN NOW() ELSE NULL END
      WHERE id = $1 AND deleted_at IS NULL`,
    [id, approved, approvedBy],
  );
  return findById(id, { includeUnpublished: true });
}

/** Facet counts for the project filter UI (§3, /api/search/facets). */
export async function facets(): Promise<{
  statuses: Array<{ value: string; count: number }>;
  types: Array<{ value: string; label: string; count: number }>;
  locations: Array<{ value: string; label: string; count: number }>;
  sectors: Array<{ value: string; label: string; count: number }>;
}> {
  const live = `p.deleted_at IS NULL AND p.published_at IS NOT NULL AND p.published_at <= NOW()`;

  const [statuses, types, locations, sectors] = await Promise.all([
    query<{ value: string; count: string }>(
      `SELECT p.status::text AS value, count(*)::text AS count
         FROM projects p WHERE ${live} GROUP BY p.status ORDER BY count DESC`,
    ),
    query<{ value: string; label: string; count: string }>(
      `SELECT pt.slug AS value, pt.name AS label, count(*)::text AS count
         FROM projects p JOIN project_types pt ON pt.id = p.project_type_id
        WHERE ${live} GROUP BY pt.slug, pt.name ORDER BY count DESC`,
    ),
    query<{ value: string; label: string; count: string }>(
      `SELECT l.slug AS value, l.name AS label, count(*)::text AS count
         FROM projects p JOIN locations l ON l.id = p.location_id
        WHERE ${live} GROUP BY l.slug, l.name ORDER BY count DESC`,
    ),
    query<{ value: string; label: string; count: string }>(
      `SELECT s.slug AS value, s.name AS label, count(*)::text AS count
         FROM projects p JOIN sectors s ON s.id = p.sector_id
        WHERE ${live} GROUP BY s.slug, s.name ORDER BY count DESC`,
    ),
  ]);

  const toCount = <T extends { count: string }>(rows: T[]) =>
    rows.map(({ count, ...rest }) => ({ ...rest, count: Number(count) }));

  return {
    statuses: toCount(statuses.rows),
    types: toCount(types.rows),
    locations: toCount(locations.rows),
    sectors: toCount(sectors.rows),
  };
}

/** Slugs of every live project — used to build getStaticPaths and the sitemap. */
export async function allPublishedSlugs(): Promise<string[]> {
  const { rows } = await query<{ slug: string }>(
    `SELECT slug FROM projects
      WHERE deleted_at IS NULL AND published_at IS NOT NULL AND published_at <= NOW()
      ORDER BY published_at DESC`,
  );
  return rows.map((r) => r.slug);
}
