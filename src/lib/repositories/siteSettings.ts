import { queryOne } from '../db';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  readHomepageSettings,
  type HomepageSettings,
} from '../schemas/settings';

/**
 * Site settings persistence — one JSONB document per key (migration 0016).
 *
 * Only the homepage document exists today. Its shape is owned by
 * src/lib/schemas/settings.ts: a key that was never saved reads as the
 * defaults, so a fresh database renders the page as built.
 */

const HOMEPAGE_KEY = 'homepage';

export interface StoredHomepageSettings {
  settings: HomepageSettings;
  updatedAt: Date | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export async function getHomepageSettings(): Promise<StoredHomepageSettings> {
  const row = await queryOne<{
    value: unknown;
    updated_at: Date;
    updated_by: string | null;
    updated_by_name: string | null;
  }>(
    `SELECT s.value, s.updated_at, s.updated_by, u.full_name AS updated_by_name
       FROM site_settings s LEFT JOIN users u ON u.id = s.updated_by
      WHERE s.key = $1`,
    [HOMEPAGE_KEY],
  );

  if (!row) {
    return {
      settings: DEFAULT_HOMEPAGE_SETTINGS,
      updatedAt: null,
      updatedBy: null,
      updatedByName: null,
    };
  }

  return {
    settings: readHomepageSettings(row.value),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
  };
}

/** Replaces the homepage document. The caller has already validated it. */
export async function saveHomepageSettings(
  settings: HomepageSettings,
  actorId: string | null,
): Promise<StoredHomepageSettings> {
  await queryOne(
    `INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
    [HOMEPAGE_KEY, JSON.stringify(settings), actorId],
  );

  return getHomepageSettings();
}
