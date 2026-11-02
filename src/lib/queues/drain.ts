import { randomUUID } from 'node:crypto';
import { Worker, type Job } from 'bullmq';
import { waitUntil } from '@vercel/functions';
import { logger } from '../logger';
import { reportError } from '../monitoring';
import { QUEUE_NAMES, queueConnection, type QueueName } from './index';
import { processEmailJob, processMaintenanceJob, processSearchJob } from './processors';

/**
 * Queue processing without a long-running worker, for serverless hosting.
 *
 * On Vercel no process stays up to run scripts/worker.ts, so jobs are drained
 * in bounded passes instead: right after the request that enqueued them (via
 * waitUntil, so the visitor does not wait), and nightly from
 * /api/cron/nightly, which also picks up jobs whose retry backoff has elapsed.
 * Jobs keep BullMQ's semantics — atomic fetch, attempts, backoff, failed-job
 * history — because they are taken and settled through a Worker in manual
 * mode rather than read off Redis directly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROCESSORS: Partial<Record<QueueName, (job: Job<any>) => Promise<void>>> = {
  [QUEUE_NAMES.email]: processEmailJob,
  [QUEUE_NAMES.search]: processSearchJob,
  [QUEUE_NAMES.maintenance]: processMaintenanceJob,
};

export interface DrainResult {
  queue: QueueName;
  completed: number;
  failed: number;
}

/**
 * Processes ready jobs one at a time until the queue is empty or the budget is
 * spent. A job started before the deadline is allowed to finish.
 */
export async function drainQueue(
  name: QueueName,
  { budgetMs, recoverStalled = false }: { budgetMs: number; recoverStalled?: boolean },
): Promise<DrainResult> {
  const result: DrainResult = { queue: name, completed: 0, failed: 0 };
  const processor = PROCESSORS[name];
  if (!processor) return result;

  const deadline = Date.now() + budgetMs;
  // No processor: the worker never fetches on its own; this loop does.
  const worker = new Worker(name, null, { connection: queueConnection() });
  const token = randomUUID();

  try {
    if (recoverStalled) {
      // A function killed mid-job leaves it active with a lapsing lock; this
      // returns such jobs to the wait list (or fails them past their limit).
      await worker.startStalledCheckTimer();
    }

    while (Date.now() < deadline) {
      const job = (await worker.getNextJob(token, { block: false })) as Job | undefined;
      if (!job) break;

      try {
        await processor(job);
        await job.moveToCompleted(undefined, token, false);
        result.completed += 1;
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        // Schedules the retry with backoff, or fails the job for good once its
        // attempts are used up.
        await job.moveToFailed(failure, token, false);
        result.failed += 1;
        logger.error('Job failed', {
          queue: name,
          jobId: job.id,
          name: job.name,
          attempt: job.attemptsMade,
          error: failure.message,
        });
        // Retries are expected; only a job that has run out of them is an incident.
        if ((await job.getState()) === 'failed') {
          reportError(failure, { queue: name, jobName: job.name, jobId: job.id });
        }
      }
    }
  } finally {
    await worker.close();
  }

  return result;
}

/** Long enough for a few emails; well inside any Vercel function limit. */
const AFTER_RESPONSE_BUDGET_MS = 8_000;

/** Drains `name` once the current response has been sent. Never throws. */
export function drainAfterResponse(name: QueueName): void {
  waitUntil(
    drainQueue(name, { budgetMs: AFTER_RESPONSE_BUDGET_MS }).catch((error: unknown) => {
      logger.error('Queue drain failed', {
        queue: name,
        error: error instanceof Error ? error.message : String(error),
      });
      reportError(error, { queue: name, source: 'drain-after-response' });
    }),
  );
}
