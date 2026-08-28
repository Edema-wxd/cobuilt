import { Queue, type JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { env, isProduction, isTest } from '../env';
import { logger } from '../logger';

/**
 * Background job queues (§14: the third app server runs the workers).
 *
 * BullMQ needs its own Redis connection with `maxRetriesPerRequest: null`
 * because blocking commands must not time out, so it cannot share the cache
 * client in ../redis.ts.
 */

export const QUEUE_NAMES = {
  email: 'email',
  search: 'search-index',
  media: 'media',
  maintenance: 'maintenance',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface EmailJobData {
  type:
    | 'inquiry-confirmation'
    | 'inquiry-notification'
    | 'investment-notification'
    | 'newsletter-confirmation'
    | 'newsletter-welcome'
    | 'password-reset'
    | 'milestone-published';
  to: string;
  payload: Record<string, unknown>;
}

export interface SearchJobData {
  action: 'upsert' | 'delete' | 'reindex';
  index: 'projects' | 'news' | 'faqs';
  id?: string;
}

export interface MediaJobData {
  action: 'tour-processed';
  tourId: string;
}

export interface MaintenanceJobData {
  action: 'purge-expired-data' | 'rebuild-search-index';
}

declare global {
  var __cobuiltQueues: Map<string, Queue> | undefined;
  var __cobuiltQueueConnection: Redis | undefined;
  var __cobuiltProducerConnection: Redis | undefined;
}

/**
 * Connection for the worker process. Blocking commands must not time out, so
 * retries are unbounded — a worker with nothing to do is supposed to wait.
 */
export function queueConnection(): Redis {
  globalThis.__cobuiltQueueConnection ??= new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return globalThis.__cobuiltQueueConnection;
}

/**
 * Connection for enqueueing from inside a request.
 *
 * Deliberately not the worker's connection: unbounded retries plus an offline
 * command queue mean that with Redis down, `add()` never settles and the HTTP
 * request hangs until the client gives up. Here a command fails immediately
 * instead, which `enqueue` catches and logs.
 */
function producerConnection(): Redis {
  if (!globalThis.__cobuiltProducerConnection) {
    const connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      enableReadyCheck: false,
      commandTimeout: 2_000,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
    });

    connection.on('error', (err) => {
      logger.warn('Queue producer connection error', { error: err.message });
    });

    globalThis.__cobuiltProducerConnection = connection;
  }

  return globalThis.__cobuiltProducerConnection;
}

const queues = (globalThis.__cobuiltQueues ??= new Map<string, Queue>());

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: producerConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    queue.on('error', (err) => logger.warn('Queue error', { queue: name, error: err.message }));
    queues.set(name, queue);
  }
  return queue;
}

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  // Keep a short history for debugging without letting Redis grow unbounded.
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/** Hard ceiling on how long a request may wait to hand a job to Redis. */
const ENQUEUE_TIMEOUT_MS = 2_000;

/**
 * Enqueues a job. Never throws, and never blocks for long: a queue outage must
 * not fail — or stall — the HTTP request that triggered it. The submission is
 * already durably stored in PostgreSQL by this point; the notification is the
 * recoverable part, and logging a dropped job beats holding a visitor's browser
 * open waiting for Redis.
 */
export async function enqueue<T extends object>(
  name: QueueName,
  jobName: string,
  data: T,
  options?: JobsOptions,
): Promise<boolean> {
  if (isTest) return true;

  try {
    await withTimeout(getQueue(name).add(jobName, data, options), ENQUEUE_TIMEOUT_MS);
    return true;
  } catch (error) {
    logger.error('Failed to enqueue job', {
      queue: name,
      jobName,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export const enqueueEmail = (data: EmailJobData, options?: JobsOptions) =>
  enqueue(QUEUE_NAMES.email, data.type, data, options);

export const enqueueSearch = (data: SearchJobData) =>
  enqueue(QUEUE_NAMES.search, `${data.action}:${data.index}`, data);

export const enqueueMedia = (data: MediaJobData) =>
  enqueue(QUEUE_NAMES.media, data.action, data);

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();

  if (globalThis.__cobuiltProducerConnection) {
    await globalThis.__cobuiltProducerConnection.quit().catch(() => undefined);
    globalThis.__cobuiltProducerConnection = undefined;
  }

  if (!isProduction) globalThis.__cobuiltQueues = undefined;
}
