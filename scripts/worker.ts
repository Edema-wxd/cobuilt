#!/usr/bin/env tsx
import { Worker } from 'bullmq';
import { QUEUE_NAMES, queueConnection, getQueue } from '../src/lib/queues/index';
import {
  processEmailJob,
  processMaintenanceJob,
  processSearchJob,
} from '../src/lib/queues/processors';
import { logger } from '../src/lib/logger';
import { pool } from '../src/lib/db';

/**
 * Background worker (§14: app server 3).
 *
 * Run with `npm run worker`. Concurrency is per queue: email is I/O-bound on a
 * third-party API, indexing is bounded by the search server.
 */

const connection = queueConnection();

const workers = [
  new Worker(QUEUE_NAMES.email, processEmailJob, { connection, concurrency: 5 }),
  new Worker(QUEUE_NAMES.search, processSearchJob, { connection, concurrency: 2 }),
  new Worker(QUEUE_NAMES.maintenance, processMaintenanceJob, { connection, concurrency: 1 }),
];

for (const worker of workers) {
  worker.on('completed', (job) => {
    logger.debug('Job completed', { queue: worker.name, jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', {
      queue: worker.name,
      jobId: job?.id,
      name: job?.name,
      attempt: job?.attemptsMade,
      error: error.message,
    });
  });
}

/**
 * Nightly maintenance at 02:00 UTC: the NDPA retention purge (§11) and the
 * full search index rebuild (§6). Job schedulers are keyed by id, so restarting
 * the worker updates the existing schedule rather than stacking duplicates.
 */
async function scheduleRecurringJobs(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.maintenance);

  await queue.upsertJobScheduler(
    'nightly-purge',
    { pattern: '0 2 * * *' },
    { name: 'purge-expired-data', data: { action: 'purge-expired-data' } },
  );

  await queue.upsertJobScheduler(
    'nightly-reindex',
    { pattern: '30 2 * * *' },
    { name: 'rebuild-search-index', data: { action: 'rebuild-search-index' } },
  );
}

async function shutdown(signal: string): Promise<void> {
  logger.info('Worker shutting down', { signal });

  // Closing each worker lets in-flight jobs finish rather than orphaning them
  // in an active state until their lock expires.
  await Promise.all(workers.map((worker) => worker.close()));
  await connection.quit();
  await pool.end();

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

scheduleRecurringJobs()
  .then(() => logger.info('Worker started', { queues: workers.map((w) => w.name) }))
  .catch((error: Error) => {
    logger.error('Failed to schedule recurring jobs', { error: error.message });
    process.exit(1);
  });
