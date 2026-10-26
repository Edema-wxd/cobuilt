import { callRoute } from '../setup/helpers';
import { env } from '@/lib/env';
import handler from '../../pages/api/cron/nightly';

jest.mock('@/lib/queues/drain', () => ({
  drainQueue: jest.fn((queue: string) => Promise.resolve({ queue, completed: 0, failed: 0 })),
}));
jest.mock('@/lib/queues/processors', () => ({ runMaintenance: jest.fn(() => Promise.resolve()) }));

const { drainQueue } = jest.requireMock('@/lib/queues/drain');
const { runMaintenance } = jest.requireMock('@/lib/queues/processors');

describe('GET /api/cron/nightly', () => {
  const mutable = env as { CRON_SECRET?: string };
  const SECRET = 'a-cron-secret-of-sufficient-length';

  beforeEach(() => {
    mutable.CRON_SECRET = SECRET;
    jest.clearAllMocks();
  });
  afterAll(() => {
    delete mutable.CRON_SECRET;
  });

  it('refuses to run when CRON_SECRET is not configured', async () => {
    delete mutable.CRON_SECRET;
    const res = await callRoute(handler, { headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.status).toBe(503);
    expect(runMaintenance).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret', async () => {
    expect((await callRoute(handler)).status).toBe(401);
    const wrong = await callRoute(handler, { headers: { authorization: 'Bearer not-the-secret' } });
    expect(wrong.status).toBe(401);
    expect(runMaintenance).not.toHaveBeenCalled();
  });

  it('only answers GET', async () => {
    const res = await callRoute(handler, {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(res.status).toBe(405);
  });

  it('drains the queues, then purges and reindexes', async () => {
    const res = await callRoute(handler, { headers: { authorization: `Bearer ${SECRET}` } });

    expect(res.status).toBe(200);
    expect(drainQueue).toHaveBeenCalledWith('email', expect.objectContaining({ recoverStalled: true }));
    expect(drainQueue).toHaveBeenCalledWith('search-index', expect.anything());
    expect(runMaintenance).toHaveBeenCalledWith('purge-expired-data');
    expect(runMaintenance).toHaveBeenCalledWith('rebuild-search-index');
  });

  it('still runs the retention purge when Redis is unavailable', async () => {
    (drainQueue as jest.Mock).mockRejectedValue(new Error('connect ECONNREFUSED'));
    const res = await callRoute(handler, { headers: { authorization: `Bearer ${SECRET}` } });

    expect(res.status).toBe(200);
    expect(runMaintenance).toHaveBeenCalledWith('purge-expired-data');
  });
});
