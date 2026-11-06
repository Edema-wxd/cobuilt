import type { PoolClient } from 'pg';
import { query, queryOne, transaction } from '../db';
import type { CreateRedirectBody, UpdateRedirectBody } from '../schemas/redirects';

/**
 * Redirect persistence (db/migrations/0023). Rows are mapped to their API
 * shape here, as for videos, so the column names stay in this file.
 *
 * Writes check for loops in the same transaction as the write, under a lock
 * only writers take, so two editors cannot each add half of a loop. A hit
 * does not take it: counting never waits on an editor.
 */

interface RedirectRow {
  id: string;
  source_path: string;
  destination: string;
  destination_path: string | null;
  permanent: boolean;
  hit_count: string;
  last_hit_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** A rule as the console shows it — `/api/admin/redirects`. */
export interface AdminRedirect {
  id: string;
  sourcePath: string;
  destination: string;
  permanent: boolean;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A rule as the lookup holds it. */
export interface RedirectRule {
  id: string;
  sourcePath: string;
  destination: string;
  permanent: boolean;
}

const COLUMNS = `id, source_path, destination, destination_path, permanent, hit_count,
                 last_hit_at, created_at, updated_at`;

function toAdmin(row: RedirectRow): AdminRedirect {
  return {
    id: row.id,
    sourcePath: row.source_path,
    destination: row.destination,
    permanent: row.permanent,
    // BIGINT arrives as text; a count this table could hold fits a number.
    hitCount: Number(row.hit_count),
    lastHitAt: row.last_hit_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Thrown when a write would chain or loop two rules. `field` is the request
 * field to blame, for the 422 the route answers with.
 */
export class RedirectLoopError extends Error {
  constructor(
    readonly field: 'sourcePath' | 'destination',
    message: string,
  ) {
    super(message);
    this.name = 'RedirectLoopError';
  }
}

/** Serialises redirect writes against each other, for the length of the transaction. */
const LOCK = `SELECT pg_advisory_xact_lock(hashtext('redirects'))`;

/**
 * No rule's source may be another rule's destination: a visitor is sent on at
 * most once, so neither a loop nor a chain can form. `excludeId` is the rule
 * being edited, which may keep its own ends.
 */
async function assertSingleHop(
  client: PoolClient,
  rule: { sourcePath: string; destinationPath: string | null },
  excludeId: string | null,
): Promise<void> {
  const landsHere = await client.query<{ source_path: string }>(
    `SELECT source_path FROM redirects
      WHERE destination_path = $1 AND id IS DISTINCT FROM $2::uuid LIMIT 1`,
    [rule.sourcePath, excludeId],
  );
  if (landsHere.rows[0]) {
    throw new RedirectLoopError(
      'sourcePath',
      `${landsHere.rows[0].source_path} already redirects here, so this path cannot redirect on. Point that rule at the final destination instead.`,
    );
  }

  if (rule.destinationPath) {
    const goesOn = await client.query<{ destination: string }>(
      `SELECT destination FROM redirects
        WHERE source_path = $1 AND id IS DISTINCT FROM $2::uuid LIMIT 1`,
      [rule.destinationPath, excludeId],
    );
    if (goesOn.rows[0]) {
      throw new RedirectLoopError(
        'destination',
        `${rule.destinationPath} is itself redirected, to ${goesOn.rows[0].destination}. Redirect straight there instead.`,
      );
    }
  }
}

/** Every rule, by source path. */
export async function listAll(): Promise<AdminRedirect[]> {
  const { rows } = await query<RedirectRow>(`SELECT ${COLUMNS} FROM redirects ORDER BY source_path`);
  return rows.map(toAdmin);
}

export async function findById(id: string): Promise<AdminRedirect | null> {
  const row = await queryOne<RedirectRow>(`SELECT ${COLUMNS} FROM redirects WHERE id = $1`, [id]);
  return row ? toAdmin(row) : null;
}

/** Throws a unique violation (23505) when the source already has a rule. */
export async function create(input: CreateRedirectBody, createdBy: string | null): Promise<AdminRedirect> {
  return transaction(async (client) => {
    await client.query(LOCK);
    if (input.destination.sitePath === input.sourcePath) {
      throw new RedirectLoopError('destination', 'A path cannot redirect to itself');
    }
    await assertSingleHop(
      client,
      { sourcePath: input.sourcePath, destinationPath: input.destination.sitePath },
      null,
    );
    const { rows } = await client.query<RedirectRow>(
      `INSERT INTO redirects (source_path, destination, destination_path, permanent, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [input.sourcePath, input.destination.destination, input.destination.sitePath, input.permanent, createdBy],
    );
    return toAdmin(rows[0]!);
  });
}

/** Null when there is no such rule. Throws a unique violation when the new source has one. */
export async function update(id: string, input: UpdateRedirectBody): Promise<AdminRedirect | null> {
  return transaction(async (client) => {
    await client.query(LOCK);
    const existing = await client.query<RedirectRow>(
      `SELECT ${COLUMNS} FROM redirects WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const current = existing.rows[0];
    if (!current) return null;

    const sourcePath = input.sourcePath ?? current.source_path;
    const destination = input.destination?.destination ?? current.destination;
    const destinationPath = input.destination ? input.destination.sitePath : current.destination_path;
    const permanent = input.permanent ?? current.permanent;

    if (destinationPath === sourcePath) {
      throw new RedirectLoopError('destination', 'A path cannot redirect to itself');
    }
    await assertSingleHop(client, { sourcePath, destinationPath }, id);

    const { rows } = await client.query<RedirectRow>(
      `UPDATE redirects
          SET source_path = $2, destination = $3, destination_path = $4, permanent = $5
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, sourcePath, destination, destinationPath, permanent],
    );
    return toAdmin(rows[0]!);
  });
}

export async function remove(id: string): Promise<AdminRedirect | null> {
  const row = await queryOne<RedirectRow>(`DELETE FROM redirects WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return row ? toAdmin(row) : null;
}

/** Every rule, for the lookup's map. */
export async function listRules(): Promise<RedirectRule[]> {
  const { rows } = await query<Pick<RedirectRow, 'id' | 'source_path' | 'destination' | 'permanent'>>(
    `SELECT id, source_path, destination, permanent FROM redirects`,
  );
  return rows.map((row) => ({
    id: row.id,
    sourcePath: row.source_path,
    destination: row.destination,
    permanent: row.permanent,
  }));
}

/** One more visitor sent on. Leaves `updated_at` alone (the trigger skips it). */
export async function recordHit(id: string): Promise<void> {
  await query(
    `UPDATE redirects SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = $1`,
    [id],
  );
}
