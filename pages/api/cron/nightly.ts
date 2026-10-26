import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { safeCompare } from '@/lib/auth/password';
import { bearerToken } from '@/lib/auth/jwt';
import { QUEUE_NAMES } from '@/lib/queues';
import { drainQueue } from '@/lib/queues/drain';
import { runMaintenance } from '@/lib/queues/processors';

/**
 * GET /api/cron/nightly — Vercel Cron, 02:00 UTC (vercel.json).
 *
 * Replaces the worker's schedulers on serverless hosting: the NDPA retention
 * purge (§11), the search index rebuild (§6), and a pass over the queues for
 * jobs whose retry backoff has elapsed or whose function was cut off mid-job.
 * Vercel authenticates the call with `Authorization: Bearer $CRON_SECRET`.
 */

export const config = { maxDuration: 60 };

/** Leaves headroom under maxDuration for the purge and reindex that follow. */
const QUEUE_BUDGET_MS = 20_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Use GET' } });
  }

  if (!env.CRON_SECRET) {
    return res
      .status(503)
      .json({ error: { code: 'service_unavailable', message: 'CRON_SECRET is not set' } });
  }

  const token = bearerToken(req.headers.authorization);
  if (!token || !safeCompare(token, env.CRON_SECRET)) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Authentication required' } });
  }

  const startedAt = Date.now();
  const queues = [];
  for (const name of [QUEUE_NAMES.email, QUEUE_NAMES.search]) {
    try {
      queues.push(await drainQueue(name, { budgetMs: QUEUE_BUDGET_MS / 2, recoverStalled: true }));
    } catch (error) {
      // Redis being down must not stop the retention purge, which is a legal
      // obligation and needs only PostgreSQL.
      logger.error('Nightly queue drain failed', {
        queue: name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await runMaintenance('purge-expired-data');
  await runMaintenance('rebuild-search-index');

  logger.info('Nightly maintenance complete', { queues, durationMs: Date.now() - startedAt });
  return res.status(200).json({ ok: true, queues, durationMs: Date.now() - startedAt });
}
