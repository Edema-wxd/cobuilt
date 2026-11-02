import { Queue } from 'bullmq';
import Redis from 'ioredis';

/**
 * The serverless drain against a real Redis. Runs when TEST_REDIS_URL is set
 * (CI provides one); the database is flushed, so never point it at a Redis
 * that holds anything you want to keep.
 */

const TEST_REDIS_URL = process.env.TEST_REDIS_URL;
const describeWithRedis = TEST_REDIS_URL ? describe : describe.skip;

const processEmailJob = jest.fn<Promise<void>, [unknown]>();
jest.mock('@/lib/queues/processors', () => ({
  processEmailJob: (job: unknown) => processEmailJob(job),
  processSearchJob: jest.fn(),
  processMaintenanceJob: jest.fn(),
}));

const reportError = jest.fn();
jest.mock('@/lib/monitoring', () => ({ reportError: (...args: unknown[]) => reportError(...args) }));

describeWithRedis('drainQueue (BullMQ manual processing)', () => {
  let redis: Redis;
  let queue: Queue;
  let drainQueue: typeof import('@/lib/queues/drain').drainQueue;

  beforeAll(async () => {
    process.env.REDIS_URL = TEST_REDIS_URL;
    ({ drainQueue } = await import('@/lib/queues/drain'));
    redis = new Redis(TEST_REDIS_URL!, { maxRetriesPerRequest: null });
    queue = new Queue('email', { connection: redis });
  });

  beforeEach(async () => {
    await redis.flushdb();
    processEmailJob.mockReset();
    reportError.mockReset();
  });

  afterAll(async () => {
    await queue.close();
    await redis.quit();
    const { queueConnection } = await import('@/lib/queues');
    await queueConnection().quit();
  });

  it('completes every ready job and leaves the queue empty', async () => {
    processEmailJob.mockResolvedValue(undefined);
    await queue.add('inquiry-confirmation', { to: 'a@example.com' });
    await queue.add('inquiry-notification', { to: 'b@example.com' });

    const result = await drainQueue('email', { budgetMs: 5_000 });

    expect(result).toEqual({ queue: 'email', completed: 2, failed: 0 });
    expect(processEmailJob).toHaveBeenCalledTimes(2);
    expect(await queue.getWaitingCount()).toBe(0);
    expect(await queue.getCompletedCount()).toBe(2);
  });

  it('schedules a retry for a failing job instead of losing it', async () => {
    processEmailJob.mockRejectedValue(new Error('provider down'));
    await queue.add('inquiry-confirmation', { to: 'a@example.com' }, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 60_000 },
    });

    const result = await drainQueue('email', { budgetMs: 5_000 });

    expect(result).toEqual({ queue: 'email', completed: 0, failed: 1 });
    expect(await queue.getDelayedCount()).toBe(1);
    // A retry is expected, not an incident.
    expect(reportError).not.toHaveBeenCalled();
  });

  it('fails a job for good once its attempts are used up', async () => {
    processEmailJob.mockRejectedValue(new Error('bad address'));
    await queue.add('inquiry-confirmation', { to: 'a@example.com' }, { attempts: 1 });

    await drainQueue('email', { budgetMs: 5_000 });

    expect(await queue.getFailedCount()).toBe(1);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'bad address' }),
      expect.objectContaining({ queue: 'email', jobName: 'inquiry-confirmation' }),
    );
  });

  it('does nothing on an empty queue', async () => {
    expect(await drainQueue('email', { budgetMs: 5_000 })).toEqual({
      queue: 'email',
      completed: 0,
      failed: 0,
    });
  });
});
