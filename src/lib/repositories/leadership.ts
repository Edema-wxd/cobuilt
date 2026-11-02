import { query, queryOne, transaction } from '../db';
import type { LeaderRow } from '@/types/models';
import type { CreateLeaderBody, UpdateLeaderBody } from '../schemas/leadership';
import { slugify, uniqueSlug } from '../slug';

/**
 * Leadership profiles. Shown on /leadership, its profile pages and the
 * homepage spotlight; written from the admin console and by the CMS sync
 * (src/lib/cms/sync.ts), which keys its rows on (cms_source, cms_id).
 *
 * Order is editorial: `sort_order` ascending, then the order rows were added.
 */

const COLUMNS = `
  id, full_name, slug, role_title, summary, bio, qualifications, expertise, quote,
  photo_url, photo_alt, social_links, tier, sort_order, published, featured,
  cms_source, cms_synced_at, created_at, updated_at
`;

const ORDER = 'ORDER BY sort_order ASC, created_at ASC, full_name ASC';

export interface ListPublishedOptions {
  /** Only the leaders chosen for the homepage spotlight. */
  featured?: boolean;
  limit?: number;
}

/** Published leaders, in editorial order. */
export async function listPublishedLeadership(
  options: ListPublishedOptions = {},
): Promise<LeaderRow[]> {
  const conditions = ['published = TRUE'];
  const params: unknown[] = [];

  if (options.featured) conditions.push('featured = TRUE');

  let limit = '';
  if (options.limit !== undefined) {
    params.push(options.limit);
    limit = `LIMIT $${params.length}`;
  }

  const { rows } = await query<LeaderRow>(
    `SELECT ${COLUMNS} FROM leadership WHERE ${conditions.join(' AND ')} ${ORDER} ${limit}`,
    params,
  );
  return rows;
}

/** One leader by slug; published only unless `includeUnpublished`. */
export async function getLeaderBySlug(
  slug: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<LeaderRow | null> {
  const published = options.includeUnpublished ? '' : 'AND published = TRUE';
  return queryOne<LeaderRow>(`SELECT ${COLUMNS} FROM leadership WHERE slug = $1 ${published}`, [
    slug,
  ]);
}

/* ---------------------------------------------------------------------------
 * Admin. Drafts included throughout.
 * ------------------------------------------------------------------------- */

export async function listAllLeadership(): Promise<LeaderRow[]> {
  const { rows } = await query<LeaderRow>(`SELECT ${COLUMNS} FROM leadership ${ORDER}`);
  return rows;
}

export async function getLeaderById(id: string): Promise<LeaderRow | null> {
  return queryOne<LeaderRow>(`SELECT ${COLUMNS} FROM leadership WHERE id = $1`, [id]);
}

/**
 * Creates a leader at the end of the running order. A new profile is a draft
 * unless `published` says otherwise: the column's own default (true) suits
 * the CMS, whose entries arrive already published, not a console form.
 */
export async function createLeader(input: CreateLeaderBody): Promise<LeaderRow> {
  const slug = await uniqueSlug('leadership', input.slug ?? slugify(input.fullName));

  const row = await queryOne<LeaderRow>(
    `INSERT INTO leadership (
       full_name, slug, role_title, summary, bio, qualifications, expertise, quote,
       photo_url, photo_alt, social_links, tier, published, featured, sort_order
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
       (SELECT coalesce(max(sort_order) + 1, 0) FROM leadership))
     RETURNING ${COLUMNS}`,
    [
      input.fullName,
      slug,
      input.roleTitle,
      input.summary ?? null,
      input.bio ?? null,
      input.qualifications ?? [],
      input.expertise ?? [],
      input.quote ?? null,
      input.photoUrl ?? null,
      input.photoAlt ?? null,
      JSON.stringify(input.socialLinks ?? {}),
      input.tier ?? 'executive',
      input.published ?? false,
      input.featured ?? false,
    ],
  );

  return row!;
}

const UPDATABLE_COLUMNS: Record<string, string> = {
  fullName: 'full_name',
  slug: 'slug',
  roleTitle: 'role_title',
  summary: 'summary',
  bio: 'bio',
  qualifications: 'qualifications',
  expertise: 'expertise',
  quote: 'quote',
  photoUrl: 'photo_url',
  photoAlt: 'photo_alt',
  socialLinks: 'social_links',
  tier: 'tier',
  published: 'published',
  featured: 'featured',
};

/** Applies the fields present in `input`; returns null when the leader does not exist. */
export async function updateLeader(id: string, input: UpdateLeaderBody): Promise<LeaderRow | null> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    params.push(field === 'socialLinks' ? JSON.stringify(value) : value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) return getLeaderById(id);

  params.push(id);
  return queryOne<LeaderRow>(
    `UPDATE leadership SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING ${COLUMNS}`,
    params,
  );
}

/** Removes a leader outright, as the CMS sync does; returns the removed row. */
export async function deleteLeader(id: string): Promise<LeaderRow | null> {
  return queryOne<LeaderRow>(`DELETE FROM leadership WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
}

/**
 * Sets the running order from the complete list of leader ids.
 *
 * The list must name every leader exactly once. A list built from a stale
 * screen — a leader added or removed since it loaded — returns false rather
 * than half-applying, so two editors reordering at once cannot interleave.
 */
export async function reorderLeadership(ids: readonly string[]): Promise<boolean> {
  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string }>('SELECT id FROM leadership FOR UPDATE');
    const current = new Set(rows.map((row) => row.id));
    if (current.size !== ids.length || ids.some((id) => !current.has(id))) return false;

    // Only rows whose position moved are written, so updated_at stays truthful.
    await client.query(
      `UPDATE leadership l
          SET sort_order = o.position::int - 1
         FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, position)
        WHERE l.id = o.id AND l.sort_order IS DISTINCT FROM o.position::int - 1`,
      [ids],
    );
    return true;
  });
}
