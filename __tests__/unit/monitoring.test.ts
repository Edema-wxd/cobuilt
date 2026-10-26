jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
}));

import * as Sentry from '@sentry/node';

type MonitoringModule = typeof import('@/lib/monitoring');

async function loadWithDsn(dsn: string | undefined): Promise<MonitoringModule> {
  if (dsn) process.env.SENTRY_DSN = dsn;
  else delete process.env.SENTRY_DSN;

  let loaded!: MonitoringModule;
  await jest.isolateModulesAsync(async () => {
    loaded = await import('@/lib/monitoring');
  });
  return loaded;
}

describe('error monitoring', () => {
  afterEach(() => {
    delete process.env.SENTRY_DSN;
    jest.clearAllMocks();
  });

  it('does nothing without SENTRY_DSN', async () => {
    const monitoring = await loadWithDsn(undefined);
    monitoring.reportError(new Error('boom'));
    await monitoring.flushErrorReports();

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.flush).not.toHaveBeenCalled();
  });

  it('initialises once, with no automatic data collection, and reports with context', async () => {
    const monitoring = await loadWithDsn('https://public@sentry.example/1');
    const error = new Error('boom');

    monitoring.reportError(error, { requestId: 'r1', path: '/api/projects' });
    monitoring.reportError(new Error('again'));

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Sentry.init).mock.calls[0]![0]).toMatchObject({
      dsn: 'https://public@sentry.example/1',
      defaultIntegrations: false,
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      extra: { requestId: 'r1', path: '/api/projects' },
    });
  });

  it('strips user and request data from every event', async () => {
    const monitoring = await loadWithDsn('https://public@sentry.example/1');
    monitoring.reportError(new Error('boom'));

    const { beforeSend } = jest.mocked(Sentry.init).mock.calls[0]![0]!;
    const event = beforeSend!(
      {
        type: undefined,
        user: { ip_address: '102.89.1.7' },
        request: { url: 'https://cobuilt.com/x?token=t' },
        message: 'kept',
      },
      {},
    ) as unknown as Record<string, unknown>;

    expect(event).toEqual({ type: undefined, message: 'kept' });
  });

  it('drops query strings from paths', async () => {
    const { pathOnly } = await loadWithDsn(undefined);
    expect(pathOnly('/api/forms/newsletter/confirm?token=secret')).toBe(
      '/api/forms/newsletter/confirm',
    );
    expect(pathOnly(undefined)).toBeUndefined();
  });
});
