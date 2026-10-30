import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/logger';
import { consume } from '@/lib/rateLimit';
import { getClientIp, pathOnly } from '@/lib/http/request';
import { readRawBody } from '@/lib/http/rawBody';

/**
 * POST /api/csp-report — receives Content Security Policy violation reports
 * (next.config.mjs), in both the legacy `report-uri` shape and the Reporting
 * API's. Each is logged with the directive, the blocked origin and the page
 * path only, so query strings and anything else in the report stay out of the
 * logs. Always answers 204: browsers ignore the response.
 */
export const config = { api: { bodyParser: false } };

const RULE = { bucket: 'csp-report', windowSeconds: 60, max: 30 };

interface Violation {
  directive: string | undefined;
  blocked: string | undefined;
  page: string | undefined;
  disposition: string | undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return;
  }

  const limit = await consume(RULE, getClientIp(req) ?? 'unknown');
  if (!limit.allowed) {
    res.status(204).end();
    return;
  }

  try {
    for (const violation of parseReports((await readRawBody(req)).toString('utf8'))) {
      logger.warn('Content Security Policy violation', { ...violation });
    }
  } catch {
    // A malformed or oversized report is dropped; there is nothing to tell the browser.
  }
  res.status(204).end();
}

export function parseReports(raw: string): Violation[] {
  const parsed: unknown = JSON.parse(raw);
  const bodies: Array<Record<string, unknown>> = Array.isArray(parsed)
    ? parsed
        .filter((r: { type?: unknown }) => r?.type === 'csp-violation')
        .map((r: { body?: unknown }) => (r.body ?? {}) as Record<string, unknown>)
    : [((parsed as Record<string, unknown>)?.['csp-report'] ?? {}) as Record<string, unknown>];

  return bodies.slice(0, 20).map((body) => ({
    directive: str(body.effectiveDirective ?? body['effective-directive'] ?? body['violated-directive']),
    blocked: originOf(str(body.blockedURL ?? body['blocked-uri'])),
    page: pagePath(str(body.documentURL ?? body['document-uri'])),
    disposition: str(body.disposition),
  }));
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, 200) : undefined;
}

/** Keeps keywords such as `inline` or `eval`; reduces a URL to its origin. */
function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function pagePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).pathname;
  } catch {
    return pathOnly(value);
  }
}
