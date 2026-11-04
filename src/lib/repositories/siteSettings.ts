import { queryOne } from '../db';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  readContactSettings,
  readHomepageSettings,
  type ContactSettings,
  type HomepageSettings,
} from '../schemas/settings';
import { DEFAULT_CONTACT_SETTINGS } from '../contactDetails';

/**
 * Site settings persistence — one JSONB document per key (migration 0016).
 *
 * Two documents exist: `homepage` (the landing page's content) and `contact`
 * (the office's address, phones, emails, WhatsApp, hours and map position).
 * Each one's shape is owned by src/lib/schemas/settings.ts: a key that was
 * never saved reads as the defaults, so a fresh database renders the pages
 * as built.
 */

const HOMEPAGE_KEY = 'homepage';
const CONTACT_KEY = 'contact';

interface Stored<T> {
  settings: T;
  updatedAt: Date | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export type StoredHomepageSettings = Stored<HomepageSettings>;
export type StoredContactSettings = Stored<ContactSettings>;

async function read<T>(key: string, parse: (value: unknown) => T, defaults: T): Promise<Stored<T>> {
  const row = await queryOne<{
    value: unknown;
    updated_at: Date;
    updated_by: string | null;
    updated_by_name: string | null;
  }>(
    `SELECT s.value, s.updated_at, s.updated_by, u.full_name AS updated_by_name
       FROM site_settings s LEFT JOIN users u ON u.id = s.updated_by
      WHERE s.key = $1`,
    [key],
  );

  if (!row) {
    return { settings: defaults, updatedAt: null, updatedBy: null, updatedByName: null };
  }

  return {
    settings: parse(row.value),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
  };
}

/** Replaces a document. The caller has already validated it. */
async function write(key: string, settings: unknown, actorId: string | null): Promise<void> {
  await queryOne(
    `INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(settings), actorId],
  );
}

export async function getHomepageSettings(): Promise<StoredHomepageSettings> {
  return read(HOMEPAGE_KEY, readHomepageSettings, DEFAULT_HOMEPAGE_SETTINGS);
}

/** Replaces the homepage document. The caller has already validated it. */
export async function saveHomepageSettings(
  settings: HomepageSettings,
  actorId: string | null,
): Promise<StoredHomepageSettings> {
  await write(HOMEPAGE_KEY, settings, actorId);
  return getHomepageSettings();
}

export async function getContactSettings(): Promise<StoredContactSettings> {
  return read(
    CONTACT_KEY,
    (value) => readContactSettings(value, DEFAULT_CONTACT_SETTINGS),
    DEFAULT_CONTACT_SETTINGS,
  );
}

/** Replaces the contact document. The caller has already validated it. */
export async function saveContactSettings(
  settings: ContactSettings,
  actorId: string | null,
): Promise<StoredContactSettings> {
  await write(CONTACT_KEY, settings, actorId);
  return getContactSettings();
}
