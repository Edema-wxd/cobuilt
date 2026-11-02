import { query, queryOne } from '../db';
import { env } from '../env';
import { logger } from '../logger';
import { reportError } from '../monitoring';
import { slugify } from '../slug';
import { normalizeNewsCategory } from '../news-categories';
import { enqueueSearch } from '../queues';
import { invalidatePrefix } from '../cache';

/**
 * Applies a CMS webhook payload to PostgreSQL.
 *
 * Upserts are keyed on (cms_source, cms_id) so a redelivered webhook updates
 * the same row rather than creating a duplicate — Strapi retries deliveries,
 * and a duplicate project would be visible to the public immediately.
 */

export type CmsEvent =
  | 'entry.create'
  | 'entry.update'
  | 'entry.publish'
  | 'entry.unpublish'
  | 'entry.delete';

export interface CmsWebhookPayload {
  event: CmsEvent;
  model: string;
  entry: Record<string, unknown>;
}

export interface SyncResult {
  status: 'applied' | 'skipped' | 'failed';
  model: string;
  entryId: string | null;
  reason?: string;
  /** Paths whose ISR cache the CMS publish should invalidate. */
  revalidate: string[];
}

const SUPPORTED_MODELS = new Set(['project', 'news-article', 'faq', 'leadership']);

export async function applyWebhook(
  payload: CmsWebhookPayload,
  deliveryId: string | null,
): Promise<SyncResult> {
  const entryId = readId(payload.entry);
  const model = payload.model;

  if (!SUPPORTED_MODELS.has(model)) {
    return await log(payload, deliveryId, {
      status: 'skipped',
      model,
      entryId,
      reason: `Model not synced: ${model}`,
      revalidate: [],
    });
  }

  if (!entryId) {
    return await log(payload, deliveryId, {
      status: 'failed',
      model,
      entryId: null,
      reason: 'Payload carried no entry id',
      revalidate: [],
    });
  }

  try {
    const result =
      payload.event === 'entry.delete'
        ? await handleDelete(model, entryId)
        : await handleUpsert(model, entryId, payload);

    return await log(payload, deliveryId, result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error('CMS sync failed', { model, entryId, event: payload.event, error: reason });
    reportError(error, { source: 'cms-sync', model, entryId, event: payload.event });
    return await log(payload, deliveryId, {
      status: 'failed',
      model,
      entryId,
      reason,
      revalidate: [],
    });
  }
}

async function handleUpsert(
  model: string,
  entryId: string,
  payload: CmsWebhookPayload,
): Promise<SyncResult> {
  const entry = payload.entry;
  // An unpublish in the CMS must take the content off the website, which for
  // us means clearing published_at rather than deleting the row.
  const published = payload.event === 'entry.unpublish' ? null : readPublishedAt(entry);

  if (model === 'project') {
    const title = readString(entry, 'title') ?? 'Untitled project';
    const slug = readString(entry, 'slug') ?? slugify(title);

    const row = await queryOne<{ id: string; slug: string }>(
      `INSERT INTO projects (
         title, slug, description, long_description, status,
         featured_image_url, meta_title, meta_description,
         published_at, cms_source, cms_id, cms_synced_at
       ) VALUES ($1,$2,$3,$4,coalesce($5::project_status,'future'),$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (cms_source, cms_id) DO UPDATE SET
         title = EXCLUDED.title,
         slug = EXCLUDED.slug,
         description = EXCLUDED.description,
         long_description = EXCLUDED.long_description,
         status = EXCLUDED.status,
         featured_image_url = EXCLUDED.featured_image_url,
         meta_title = EXCLUDED.meta_title,
         meta_description = EXCLUDED.meta_description,
         published_at = EXCLUDED.published_at,
         deleted_at = NULL,
         cms_synced_at = NOW()
       RETURNING id, slug`,
      [
        title,
        slug,
        readString(entry, 'description'),
        readString(entry, 'longDescription') ?? readString(entry, 'long_description'),
        readString(entry, 'status'),
        readString(entry, 'featuredImageUrl'),
        readString(entry, 'metaTitle'),
        readString(entry, 'metaDescription'),
        published,
        env.CMS_SOURCE,
        entryId,
      ],
    );

    await enqueueSearch({ action: 'upsert', index: 'projects', id: row!.id });
    await invalidatePrefix('projects');

    return {
      status: 'applied',
      model,
      entryId,
      revalidate: ['/projects', `/projects/${row!.slug}`, `/projects/${row!.slug}/passport`],
    };
  }

  if (model === 'news-article') {
    const title = readString(entry, 'title') ?? 'Untitled article';
    const slug = readString(entry, 'slug') ?? slugify(title);

    const row = await queryOne<{ id: string; slug: string }>(
      `INSERT INTO news_articles (
         title, slug, content, excerpt, category, featured_image_url,
         meta_title, meta_description, tags, published_at,
         cms_source, cms_id, cms_synced_at
       ) VALUES ($1,$2,coalesce($3,''),$4,$5,$6,$7,$8,coalesce($9::text[],'{}'::text[]),$10,$11,$12,NOW())
       ON CONFLICT (cms_source, cms_id) DO UPDATE SET
         title = EXCLUDED.title,
         slug = EXCLUDED.slug,
         content = EXCLUDED.content,
         excerpt = EXCLUDED.excerpt,
         category = EXCLUDED.category,
         featured_image_url = EXCLUDED.featured_image_url,
         meta_title = EXCLUDED.meta_title,
         meta_description = EXCLUDED.meta_description,
         tags = EXCLUDED.tags,
         published_at = EXCLUDED.published_at,
         deleted_at = NULL,
         cms_synced_at = NOW()
       RETURNING id, slug`,
      [
        title,
        slug,
        readString(entry, 'content'),
        readString(entry, 'excerpt'),
        // A CMS still sending `update` or "Press release" lands on the same
        // category as the console's; an unknown one is kept as sent.
        normalizeNewsCategory(readString(entry, 'category')),
        readString(entry, 'featuredImageUrl'),
        readString(entry, 'metaTitle'),
        readString(entry, 'metaDescription'),
        readStringArray(entry, 'tags'),
        published,
        env.CMS_SOURCE,
        entryId,
      ],
    );

    await enqueueSearch({ action: 'upsert', index: 'news', id: row!.id });
    await invalidatePrefix('news');

    return { status: 'applied', model, entryId, revalidate: ['/news', `/news/${row!.slug}`] };
  }

  if (model === 'faq') {
    await query(
      `INSERT INTO faqs (question, answer, category, sort_order, published, cms_source, cms_id)
       VALUES ($1, coalesce($2,''), $3, coalesce($4, 0), $5, $6, $7)
       ON CONFLICT (cms_source, cms_id) DO UPDATE SET
         question = EXCLUDED.question,
         answer = EXCLUDED.answer,
         category = EXCLUDED.category,
         sort_order = EXCLUDED.sort_order,
         published = EXCLUDED.published`,
      [
        readString(entry, 'question') ?? '',
        readString(entry, 'answer'),
        readString(entry, 'category'),
        readNumber(entry, 'sortOrder'),
        published !== null,
        env.CMS_SOURCE,
        entryId,
      ],
    );

    await enqueueSearch({ action: 'reindex', index: 'faqs' });
    await invalidatePrefix('faqs');
    return { status: 'applied', model, entryId, revalidate: ['/faqs'] };
  }

  // leadership
  const fullName = readString(entry, 'fullName') ?? readString(entry, 'name') ?? 'Unnamed';
  const tier = readString(entry, 'tier');
  // The profile fields added in 0017 are optional in the CMS model: one it
  // does not send (null here) keeps the value set in the console rather than
  // clearing it, so an older Strapi model keeps syncing unchanged.
  const row = await queryOne<{ slug: string }>(
    `INSERT INTO leadership (
       full_name, slug, role_title, bio, photo_url, social_links, sort_order, published,
       summary, qualifications, expertise, quote, photo_alt, tier, featured,
       cms_source, cms_id, cms_synced_at
     ) VALUES ($1,$2,$3,$4,$5,coalesce($6::jsonb,'{}'::jsonb),coalesce($7,0),$8,
       $9,coalesce($10::text[],'{}'::text[]),coalesce($11::text[],'{}'::text[]),$12,$13,
       coalesce($14,'executive'),coalesce($15,FALSE),$16,$17,NOW())
     ON CONFLICT (cms_source, cms_id) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       role_title = EXCLUDED.role_title,
       bio = EXCLUDED.bio,
       photo_url = EXCLUDED.photo_url,
       social_links = EXCLUDED.social_links,
       sort_order = EXCLUDED.sort_order,
       published = EXCLUDED.published,
       summary = coalesce($9, leadership.summary),
       qualifications = coalesce($10::text[], leadership.qualifications),
       expertise = coalesce($11::text[], leadership.expertise),
       quote = coalesce($12, leadership.quote),
       photo_alt = coalesce($13, leadership.photo_alt),
       tier = coalesce($14, leadership.tier),
       featured = coalesce($15, leadership.featured),
       cms_synced_at = NOW()
     RETURNING slug`,
    [
      fullName,
      readString(entry, 'slug') ?? slugify(fullName),
      readString(entry, 'roleTitle') ?? readString(entry, 'role'),
      readString(entry, 'bio'),
      readString(entry, 'photoUrl'),
      entry.socialLinks ? JSON.stringify(entry.socialLinks) : null,
      readNumber(entry, 'sortOrder'),
      published !== null,
      readString(entry, 'summary'),
      readStringArray(entry, 'qualifications'),
      readStringArray(entry, 'expertise') ?? readStringArray(entry, 'areasOfExpertise'),
      readString(entry, 'quote'),
      readString(entry, 'photoAlt'),
      // An unknown tier would fail the CHECK and the whole sync with it.
      tier && LEADERSHIP_TIERS.has(tier) ? tier : null,
      readBoolean(entry, 'featured'),
      env.CMS_SOURCE,
      entryId,
    ],
  );

  await invalidatePrefix('leadership');

  return {
    status: 'applied',
    model,
    entryId,
    revalidate: ['/', '/about', '/investors', '/leadership', `/leadership/${row!.slug}`],
  };
}

const LEADERSHIP_TIERS = new Set(['board', 'executive', 'management']);

async function handleDelete(model: string, entryId: string): Promise<SyncResult> {
  if (model === 'project') {
    const row = await queryOne<{ id: string; slug: string }>(
      `UPDATE projects SET deleted_at = NOW()
        WHERE cms_source = $1 AND cms_id = $2 AND deleted_at IS NULL
        RETURNING id, slug`,
      [env.CMS_SOURCE, entryId],
    );
    if (row) {
      await enqueueSearch({ action: 'delete', index: 'projects', id: row.id });
      await invalidatePrefix('projects');
      return {
        status: 'applied',
        model,
        entryId,
        revalidate: ['/projects', `/projects/${row.slug}`, `/projects/${row.slug}/passport`],
      };
    }
    return { status: 'skipped', model, entryId, reason: 'No matching row', revalidate: [] };
  }

  if (model === 'news-article') {
    const row = await queryOne<{ id: string; slug: string }>(
      `UPDATE news_articles SET deleted_at = NOW()
        WHERE cms_source = $1 AND cms_id = $2 AND deleted_at IS NULL
        RETURNING id, slug`,
      [env.CMS_SOURCE, entryId],
    );
    if (row) {
      await enqueueSearch({ action: 'delete', index: 'news', id: row.id });
      await invalidatePrefix('news');
      return { status: 'applied', model, entryId, revalidate: ['/news', `/news/${row.slug}`] };
    }
    return { status: 'skipped', model, entryId, reason: 'No matching row', revalidate: [] };
  }

  const table = model === 'faq' ? 'faqs' : 'leadership';
  await query(`DELETE FROM ${table} WHERE cms_source = $1 AND cms_id = $2`, [
    env.CMS_SOURCE,
    entryId,
  ]);

  if (model === 'leadership') {
    await invalidatePrefix('leadership');
    return { status: 'applied', model, entryId, revalidate: ['/', '/leadership'] };
  }

  return { status: 'applied', model, entryId, revalidate: [] };
}

async function log(
  payload: CmsWebhookPayload,
  deliveryId: string | null,
  result: SyncResult,
): Promise<SyncResult> {
  await query(
    `INSERT INTO cms_sync_log (cms_source, delivery_id, model, entry_id, event, status, error, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (cms_source, delivery_id) DO NOTHING`,
    [
      env.CMS_SOURCE,
      deliveryId,
      result.model,
      result.entryId,
      payload.event,
      result.status,
      result.reason ?? null,
      JSON.stringify(payload).slice(0, 100_000),
    ],
  ).catch((error: Error) => {
    logger.warn('Failed to write CMS sync log', { error: error.message });
  });

  return result;
}

// Strapi v4 nests fields under `attributes`; v5 flattens them. Read both.
function field(entry: Record<string, unknown>, name: string): unknown {
  if (name in entry) return entry[name];
  const attributes = entry.attributes;
  if (attributes && typeof attributes === 'object' && name in attributes) {
    return (attributes as Record<string, unknown>)[name];
  }
  return undefined;
}

function readId(entry: Record<string, unknown>): string | null {
  // Strapi v4 ids are numbers, v5 documentIds are strings. Anything else is
  // not an identifier, and stringifying it would store "[object Object]".
  const value = entry.documentId ?? entry.id;
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function readString(entry: Record<string, unknown>, name: string): string | null {
  const value = field(entry, name);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(entry: Record<string, unknown>, name: string): number | null {
  const value = field(entry, name);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(entry: Record<string, unknown>, name: string): boolean | null {
  const value = field(entry, name);
  return typeof value === 'boolean' ? value : null;
}

function readStringArray(entry: Record<string, unknown>, name: string): string[] | null {
  const value = field(entry, name);
  if (!Array.isArray(value)) return null;
  return value.filter((v): v is string => typeof v === 'string');
}

function readPublishedAt(entry: Record<string, unknown>): Date | null {
  const value = field(entry, 'publishedAt') ?? field(entry, 'published_at');
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
