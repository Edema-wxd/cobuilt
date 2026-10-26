import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

type Handler = (path: string) => { status: number; body: string };

let server: Server;
let baseUrl: string;
let handler: Handler;
const received: Array<{ path: string; body: string }> = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      received.push({ path: req.url ?? '', body });
      const reply = handler(req.url ?? '');
      res.writeHead(reply.status, { 'Content-Type': 'application/json' }).end(reply.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  received.length = 0;
  handler = () => ({ status: 200, body: '{}' });
});

afterEach(() => {
  delete process.env.ALERT_WEBHOOK_URL;
  delete process.env.ALERT_EMAIL;
});

async function load<T>(path: string): Promise<T> {
  let loaded!: T;
  await jest.isolateModulesAsync(async () => {
    loaded = (await import(path)) as T;
  });
  return loaded;
}

describe('sendAlert', () => {
  type Alerts = typeof import('@/lib/ops/alerts');

  it('posts a Slack-compatible message to the webhook', async () => {
    process.env.ALERT_WEBHOOK_URL = `${baseUrl}/hook`;
    const { sendAlert } = await load<Alerts>('@/lib/ops/alerts');

    const delivered = await sendAlert({
      severity: 'critical',
      title: 'Site down',
      detail: 'HTTP 503',
    });

    expect(delivered).toBe(true);
    expect(received).toEqual([
      { path: '/hook', body: JSON.stringify({ text: '[CRITICAL] Site down\nHTTP 503' }) },
    ]);
  });

  it('reports failure when the webhook rejects the alert', async () => {
    process.env.ALERT_WEBHOOK_URL = `${baseUrl}/hook`;
    handler = () => ({ status: 500, body: '' });
    const { sendAlert } = await load<Alerts>('@/lib/ops/alerts');

    expect(await sendAlert({ severity: 'warning', title: 't', detail: 'd' })).toBe(false);
  });

  it('does not count the log mail transport as a way to reach anyone', async () => {
    process.env.ALERT_EMAIL = 'ops@cobuilt.test';
    const { sendAlert } = await load<Alerts>('@/lib/ops/alerts');

    expect(await sendAlert({ severity: 'warning', title: 't', detail: 'd' })).toBe(false);
  });
});

describe('checkHealthUrl', () => {
  type Monitor = typeof import('@/lib/ops/healthMonitor');

  const reply = (status: number, body: unknown) => () => ({ status, body: JSON.stringify(body) });

  it('maps each /api/health answer to an observation', async () => {
    const { checkHealthUrl } = await load<Monitor>('@/lib/ops/healthMonitor');
    const url = `${baseUrl}/api/health`;

    handler = reply(200, { status: 'healthy' });
    expect(await checkHealthUrl(url)).toMatchObject({ ok: true });

    handler = reply(200, { status: 'degraded', degraded: ['redis', 'search'] });
    expect(await checkHealthUrl(url)).toEqual({
      ok: false,
      severity: 'warning',
      detail: 'Degraded: redis, search',
    });

    handler = reply(503, { status: 'unhealthy' });
    expect(await checkHealthUrl(url)).toEqual({
      ok: false,
      severity: 'critical',
      detail: 'HTTP 503, status unhealthy',
    });

    handler = () => ({ status: 502, body: '<html>Bad gateway</html>' });
    expect(await checkHealthUrl(url)).toMatchObject({
      severity: 'critical',
      detail: 'HTTP 502, status unreadable',
    });
  });

  it('treats a refused connection as critical', async () => {
    const { checkHealthUrl } = await load<Monitor>('@/lib/ops/healthMonitor');
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));

    const result = await checkHealthUrl(`http://127.0.0.1:${port}/api/health`);
    expect(result.ok).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.detail).toMatch(/^Unreachable: .*ECONNREFUSED/);
  });
});
