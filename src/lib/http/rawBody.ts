import type { NextApiRequest } from 'next';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Raw-body reading and HMAC verification for inbound webhooks.
 *
 * A signature covers the exact bytes that were sent, so it must be checked
 * against the raw body — Next.js's parsed `req.body` has already lost the
 * original key order and whitespace, and re-serialising it produces a
 * different string that will not verify.
 *
 * Routes using this must disable the body parser:
 *   export const config = { api: { bodyParser: false } };
 */

const MAX_WEBHOOK_BYTES = 1024 * 1024; // 1 MB

export async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buffer.length;
    if (total > MAX_WEBHOOK_BYTES) {
      throw new Error('Webhook payload exceeds the 1 MB limit');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

/**
 * Verifies an HMAC-SHA256 signature. `signature` may carry a `sha256=` prefix,
 * as Meta's WhatsApp webhooks send.
 */
export function verifyHmac(input: {
  payload: Buffer;
  signature: string | null;
  secret: string;
}): boolean {
  if (!input.signature) return false;

  const provided = input.signature.startsWith('sha256=')
    ? input.signature.slice(7)
    : input.signature;

  const expected = createHmac('sha256', input.secret).update(input.payload).digest('hex');

  const providedBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function parseJson<T>(payload: Buffer): T {
  return JSON.parse(payload.toString('utf8')) as T;
}
