import { env } from '../env';
import { logger } from '../logger';

/**
 * Strapi read client (§5).
 *
 * The CMS is the authoring system of record for editorial content; PostgreSQL
 * holds the projection the API serves (see docs/cms-sync.md for why). This
 * client is used by the sync path and by the reconciliation script — request
 * handlers read from PostgreSQL, never from the CMS, so a CMS outage cannot
 * take the website down.
 */

export interface StrapiEntry {
  id: number | string;
  documentId?: string;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StrapiListResponse<T = StrapiEntry> {
  data: T[];
  meta?: { pagination?: { page: number; pageSize: number; pageCount: number; total: number } };
}

export function isCmsConfigured(): boolean {
  return Boolean(env.STRAPI_API_URL && env.STRAPI_API_TOKEN);
}

async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!isCmsConfigured()) {
    throw new Error('Strapi is not configured (STRAPI_API_URL / STRAPI_API_TOKEN)');
  }

  const url = new URL(path.replace(/^\//, ''), `${env.STRAPI_API_URL!.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.STRAPI_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Strapi request failed: ${response.status} ${url.pathname}`);
  }

  return (await response.json()) as T;
}

export async function fetchEntry(model: string, id: string): Promise<StrapiEntry | null> {
  try {
    const result = await request<{ data: StrapiEntry | null }>(`api/${model}/${id}`, {
      populate: '*',
    });
    return result.data;
  } catch (error) {
    logger.error('Failed to fetch CMS entry', {
      model,
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function fetchAll(model: string, pageSize = 100): Promise<StrapiEntry[]> {
  const entries: StrapiEntry[] = [];
  let page = 1;

  for (;;) {
    const result = await request<StrapiListResponse>(`api/${model}`, {
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
      populate: '*',
    });

    entries.push(...result.data);

    const pageCount = result.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
    page += 1;
  }

  return entries;
}

export async function checkCms(): Promise<boolean> {
  if (!isCmsConfigured()) return false;
  try {
    await request('api/projects', { 'pagination[pageSize]': '1' });
    return true;
  } catch {
    return false;
  }
}
