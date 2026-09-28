import { revalidatePath } from 'next/cache';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { applyWebhook, type CmsWebhookPayload } from '@/lib/cms/sync';
import { parseJson, readRawRequestBody, verifyHmac } from '@/lib/http/rawBody';
import { safeCompare } from '@/lib/auth/password';

/**
 * POST /api/integrations/cms-webhooks — CMS publish hook (§5).
 *
 * Applies the change to PostgreSQL, then revalidates the affected pages so an
 * editor's publish is live within seconds instead of at the next revalidation
 * window.
 *
 * This is the one API route in `app/` rather than `pages/api` (docs/decisions.md
 * §2.12). `revalidatePath` is the only way to revalidate an App Router page, and
 * calling it from a pages API route throws "static generation store missing" —
 * so a route that exists to revalidate pages has to live where the page cache
 * does. It bypasses the shared `createRoute` pipeline either way, because a
 * signature has to be checked against the raw bytes before anything parses them.
 *
 * Strapi signs with a static bearer token by default; an HMAC signature is
 * accepted too, for a proxy that adds one.
 */

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  if (!env.CMS_WEBHOOK_SECRET) {
    logger.error('CMS webhook received but CMS_WEBHOOK_SECRET is not configured');
    return json(503, { error: { code: 'service_unavailable', message: 'Not configured' } });
  }

  let payload: Buffer;
  try {
    payload = await readRawRequestBody(request);
  } catch {
    return json(413, { error: { code: 'payload_too_large', message: 'Payload too large' } });
  }

  if (!isAuthentic(request, payload)) {
    logger.warn('Rejected CMS webhook with invalid credentials');
    return json(401, { error: { code: 'unauthorized', message: 'Invalid signature' } });
  }

  let body: CmsWebhookPayload;
  try {
    body = parseJson<CmsWebhookPayload>(payload);
  } catch {
    return json(400, { error: { code: 'bad_request', message: 'Malformed JSON' } });
  }

  if (!body?.event || !body?.model) {
    return json(400, {
      error: { code: 'bad_request', message: 'Payload must carry `event` and `model`' },
    });
  }

  const deliveryId =
    request.headers.get('x-delivery-id') ?? request.headers.get('idempotency-key');
  const result = await applyWebhook(body, deliveryId);

  // Revalidation is best-effort: the data is already committed, and a failure
  // here only means the page refreshes on its normal schedule.
  const revalidated: string[] = [];
  for (const path of result.revalidate) {
    try {
      revalidatePath(path);
      revalidated.push(path);
    } catch (error) {
      logger.warn('Revalidation failed', {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return json(result.status === 'failed' ? 500 : 200, {
    received: true,
    status: result.status,
    model: result.model,
    entryId: result.entryId,
    reason: result.reason,
    revalidated,
  });
}

function isAuthentic(request: Request, payload: Buffer): boolean {
  const secret = env.CMS_WEBHOOK_SECRET!;

  const signature =
    request.headers.get('x-cms-signature') ?? request.headers.get('x-hub-signature-256');
  if (signature) return verifyHmac({ payload, signature, secret });

  const authorization = request.headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return safeCompare(authorization.slice(7).trim(), secret);
  }

  return false;
}
