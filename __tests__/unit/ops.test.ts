import { advance, INITIAL_STATE, type Observation } from '@/lib/ops/healthMonitor';
import { backupFileName, expiredBackups, pgEnv, type BackupFile } from '@/lib/ops/backups';

const MIN = 60_000;
const HOUR = 60 * MIN;
const REPEAT = 4 * HOUR;

const down: Observation = { ok: false, severity: 'critical', detail: 'Unreachable' };
const degraded: Observation = { ok: false, severity: 'warning', detail: 'Degraded: redis' };
const healthy: Observation = { ok: true, severity: 'warning', detail: 'Healthy' };

function run(observations: Array<[Observation, number]>) {
  let state = INITIAL_STATE;
  return observations.map(([observation, at]) => {
    const step = advance(state, observation, at, REPEAT);
    state = step.state;
    return step.alert?.severity ?? null;
  });
}

describe('alert thresholds', () => {
  it('alerts on the second consecutive critical check, not the first', () => {
    expect(
      run([
        [down, 0],
        [down, MIN],
        [down, 2 * MIN],
      ]),
    ).toEqual([null, 'critical', null]);
  });

  it('ignores a single blip', () => {
    expect(
      run([
        [down, 0],
        [healthy, MIN],
        [down, 2 * MIN],
      ]),
    ).toEqual([null, null, null]);
  });

  it('waits 15 minutes before alerting on degraded', () => {
    expect(
      run([
        [degraded, 0],
        [degraded, 14 * MIN],
        [degraded, 15 * MIN],
      ]),
    ).toEqual([null, null, 'warning']);
  });

  it('escalates from degraded to down without waiting for the repeat interval', () => {
    expect(
      run([
        [degraded, 0],
        [degraded, 15 * MIN],
        [down, 16 * MIN],
        [down, 17 * MIN],
      ]),
    ).toEqual([null, 'warning', null, 'critical']);
  });

  it('repeats while still failing, then sends one recovery notice', () => {
    expect(
      run([
        [down, 0],
        [down, MIN],
        [down, 2 * HOUR],
        [down, MIN + REPEAT],
        [healthy, MIN + REPEAT + MIN],
        [healthy, MIN + REPEAT + 2 * MIN],
      ]),
    ).toEqual([null, 'critical', null, 'critical', 'resolved', null]);
  });

  it('sends no recovery notice for a failure that never alerted', () => {
    expect(
      run([
        [down, 0],
        [healthy, MIN],
      ]),
    ).toEqual([null, null]);
  });
});

describe('backup helpers', () => {
  it('turns a DATABASE_URL into libpq variables, decoding the password', () => {
    expect(pgEnv('postgresql://backup%40ops:p%40ss%3Aw%2Frd%231@db.internal:6543/cobuilt')).toEqual(
      {
        PGHOST: 'db.internal',
        PGPORT: '6543',
        PGUSER: 'backup@ops',
        PGPASSWORD: 'p@ss:w/rd#1',
        PGDATABASE: 'cobuilt',
      },
    );
  });

  it('carries TLS settings, verifying the certificate when DATABASE_SSL is on', () => {
    expect(pgEnv('postgres://u@h/db', true)).toMatchObject({
      PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: 'system',
    });
    expect(pgEnv('postgres://u@h/db?sslmode=require')).toMatchObject({ PGSSLMODE: 'require' });
    expect(pgEnv('postgres://u@[::1]:5432/db').PGHOST).toBe('::1');
  });

  it('rejects anything that is not a postgres URL', () => {
    expect(() => pgEnv('mysql://u@h/db')).toThrow('postgres');
  });

  it('names archives so they sort by time', () => {
    expect(backupFileName(new Date('2026-10-26T01:30:00.123Z'))).toBe(
      'cobuilt-2026-10-26T01-30-00-123Z.dump',
    );
  });

  it('expires archives past retention but always keeps the newest', () => {
    const now = Date.UTC(2026, 9, 26);
    const file = (name: string, daysOld: number): BackupFile => ({
      name,
      path: `/b/${name}`,
      mtimeMs: now - daysOld * 24 * HOUR,
      bytes: 1,
    });

    expect(
      expiredBackups([file('a', 1), file('b', 6), file('c', 8), file('d', 30)], now, 7).map(
        (f) => f.name,
      ),
    ).toEqual(['c', 'd']);
    expect(expiredBackups([file('only', 30)], now, 7)).toEqual([]);
  });
});
