import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { applyWebhook, type CmsWebhookPayload } from '@/lib/cms/sync';
import { parseJson, readRawBody, verifyHmac } from '@/lib/http/rawBody';
import { header } from '@/lib/http/request';
import { safeCompare } from '@/lib/auth/password';

/**
 * POST /api/integrations/cms-webhooks — CMS publish hook (§5).
 *
 * Applies the change to PostgreSQL, then revalidates the affected ISR pages so
 * an editor's publish is live within seconds instead of at the next
 * revalidation window.
 *
 * Strapi signs with a static bearer token by default; an HMAC signature is
 * accepted too, for a proxy that adds one. Either way the raw body is needed,
 * so the parser is disabled.
 */
export const config = { api: { bodyParser: false } };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { code: 'method_not_allowed', message: 'Method not allowed' } });
    return;
  }

  if (!env.CMS_WEBHOOK_SECRET) {
    logger.error('CMS webhook received but CMS_WEBHOOK_SECRET is not configured');
    res.status(503).json({ error: { code: 'service_unavailable', message: 'Not configured' } });
    return;
  }

  let payload: Buffer;
  try {
    payload = await readRawBody(req);
  } catch {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'Payload too large' } });
    return;
  }

  if (!isAuthentic(req, payload)) {
    logger.warn('Rejected CMS webhook with invalid credentials');
    res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid signature' } });
    return;
  }

  let body: CmsWebhookPayload;
  try {
    body = parseJson<CmsWebhookPayload>(payload);
  } catch {
    res.status(400).json({ error: { code: 'bad_request', message: 'Malformed JSON' } });
    return;
  }

  if (!body?.event || !body?.model) {
    res.status(400).json({
      error: { code: 'bad_request', message: 'Payload must carry `event` and `model`' },
    });
    return;
  }

  const deliveryId = header(req, 'x-delivery-id') ?? header(req, 'idempotency-key');
  const result = await applyWebhook(body, deliveryId);

  // ISR revalidation is best-effort: the data is already committed, and a
  // failure here only means the page refreshes on its normal schedule.
  const revalidated: string[] = [];
  for (const path of result.revalidate) {
    try {
      await res.revalidate(path);
      revalidated.push(path);
    } catch (error) {
      logger.warn('ISR revalidation failed', {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  res.status(result.status === 'failed' ? 500 : 200).json({
    received: true,
    status: result.status,
    model: result.model,
    entryId: result.entryId,
    reason: result.reason,
    revalidated,
  });
}

function isAuthentic(req: NextApiRequest, payload: Buffer): boolean {
  const secret = env.CMS_WEBHOOK_SECRET!;

  const signature = header(req, 'x-cms-signature') ?? header(req, 'x-hub-signature-256');
  if (signature) return verifyHmac({ payload, signature, secret });

  const authorization = header(req, 'authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return safeCompare(authorization.slice(7).trim(), secret);
  }

  return false;
}
