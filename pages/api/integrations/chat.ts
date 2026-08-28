import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { query } from '@/lib/db';
import { parseJson, readRawBody, verifyHmac } from '@/lib/http/rawBody';
import { header } from '@/lib/http/request';

/**
 * POST /api/integrations/chat — live-chat provider webhook (§9).
 *
 * Chatwoot and Intercom both sign deliveries with an HMAC over the raw body,
 * so the body parser is disabled here as it is for WhatsApp. The payload is
 * stored generically: the platform is still an open decision (§17), and this
 * shape does not commit the schema to either vendor.
 */
export const config = { api: { bodyParser: false } };

interface ChatWebhookBody {
  event?: string;
  id?: string | number;
  conversation?: { id?: string | number };
  content?: string;
  sender?: { email?: string; name?: string };
  data?: Record<string, unknown>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { code: 'method_not_allowed', message: 'Method not allowed' } });
    return;
  }

  if (!env.CHAT_WEBHOOK_SECRET) {
    logger.error('Chat webhook received but CHAT_WEBHOOK_SECRET is not configured');
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

  const signature =
    header(req, 'x-chatwoot-signature') ??
    header(req, 'x-hub-signature-256') ??
    header(req, 'x-signature');

  if (!verifyHmac({ payload, signature, secret: env.CHAT_WEBHOOK_SECRET })) {
    logger.warn('Rejected chat webhook with an invalid signature');
    res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid signature' } });
    return;
  }

  res.status(200).json({ received: true });

  try {
    const body = parseJson<ChatWebhookBody>(payload);

    await query(
      `INSERT INTO chat_events
         (provider, provider_event_id, conversation_id, event_type, contact_email, contact_name, content, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (provider_event_id) DO NOTHING`,
      [
        'chatwoot',
        body.id ? String(body.id) : null,
        body.conversation?.id ? String(body.conversation.id) : null,
        body.event ?? 'unknown',
        body.sender?.email ?? null,
        body.sender?.name ?? null,
        body.content ?? null,
        JSON.stringify(body).slice(0, 100_000),
      ],
    );

    logger.info('Chat event stored', { event: body.event });
  } catch (error) {
    logger.error('Failed to process chat webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
