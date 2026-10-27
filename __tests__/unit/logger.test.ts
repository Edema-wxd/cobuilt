import { Writable } from 'node:stream';
import winston from 'winston';
import { logger } from '@/lib/logger';

describe('logger', () => {
  it('delivers entries to transports and redacts sensitive keys', () => {
    const lines: string[] = [];
    const transport = new winston.transports.Stream({
      stream: new Writable({
        write(chunk: Buffer, _encoding, callback) {
          lines.push(chunk.toString());
          callback();
        },
      }),
    });
    logger.add(transport);

    try {
      logger.error('Something failed', { password: 'hunter2', nested: { token: 't', keep: 'k' } });
    } finally {
      logger.remove(transport);
    }

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!) as Record<string, any>;
    expect(entry).toMatchObject({
      level: 'error',
      message: 'Something failed',
      password: '[redacted]',
      nested: { token: '[redacted]', keep: 'k' },
    });
  });
});
