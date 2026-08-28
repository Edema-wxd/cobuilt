import { query } from './db';

/**
 * URL slug generation. Slugs are part of the public URL and the SEO surface,
 * so they must be stable and collision-free.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Strip combining marks so "Lékki" and "Lekki" produce the same slug.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

const SLUGGABLE_TABLES = new Set([
  'projects',
  'news_articles',
  'gallery_albums',
  'leadership',
  'project_types',
  'locations',
  'sectors',
  'services',
  'tags',
]);

/**
 * Returns `base`, or `base-2`, `base-3`, ... if taken.
 *
 * The table name is interpolated into the SQL because an identifier cannot be
 * a bind parameter; it is checked against an allowlist first, so no caller can
 * turn this into an injection point.
 */
export async function uniqueSlug(
  table: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  if (!SLUGGABLE_TABLES.has(table)) {
    throw new Error(`uniqueSlug called with unknown table: ${table}`);
  }

  const root = base.length > 0 ? base : 'item';

  const { rows } = await query<{ slug: string }>(
    `SELECT slug FROM ${table}
      WHERE (slug = $1 OR slug LIKE $1 || '-%')
        AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [root, excludeId ?? null],
  );

  if (rows.length === 0) return root;

  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(root)) return root;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Practically unreachable; falls back to a value that cannot collide.
  return `${root}-${Date.now()}`;
}
