import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { query } from '@/lib/db';
import { safeCompare } from '@/lib/auth/password';
import { parseJson, readRawBody, verifyHmac } from '@/lib/http/rawBody';
import { header, queryParam } from '@/lib/http/request';

/**
 * /api/integrations/whatsapp — Meta WhatsApp Business webhook (§9).
 *
 * GET  performs Meta's subscription handshake.
 * POST receives message events, verified by the app-secret HMAC.
 *
 * This route bypasses createRoute because the signature must be checked
 * against the raw request bytes, which requires the body parser to be off.
 */
export const config = { api: { bodyParser: false } };

interface WhatsAppWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          timestamp?: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{ id?: string; status?: string; recipient_id?: string }>;
      };
    }>;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method === 'GET') {
    const mode = queryParam(req, 'hub.mode');
    const token = queryParam(req, 'hub.verify_token');
    const challenge = queryParam(req, 'hub.challenge');

    if (
      mode === 'subscribe' &&
      token &&
      env.WHATSAPP_WEBHOOK_TOKEN &&
      safeCompare(token, env.WHATSAPP_WEBHOOK_TOKEN)
    ) {
      res.status(200).send(challenge ?? '');
      return;
    }

    res.status(403).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: { code: 'method_not_allowed', message: 'Method not allowed' } });
    return;
  }

  let payload: Buffer;
  try {
    payload = await readRawBody(req);
  } catch {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'Payload too large' } });
    return;
  }

  if (!env.WHATSAPP_APP_SECRET) {
    logger.error('WhatsApp webhook received but WHATSAPP_APP_SECRET is not configured');
    res.status(503).json({ error: { code: 'service_unavailable', message: 'Not configured' } });
    return;
  }

  const valid = verifyHmac({
    payload,
    signature: header(req, 'x-hub-signature-256'),
    secret: env.WHATSAPP_APP_SECRET,
  });

  if (!valid) {
    logger.warn('Rejected WhatsApp webhook with an invalid signature');
    res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid signature' } });
    return;
  }

  // Meta retries any delivery it does not see acknowledged quickly, so the
  // handler acknowledges first and does its work without holding the response.
  res.status(200).json({ received: true });

  try {
    const body = parseJson<WhatsAppWebhookBody>(payload);
    await persist(body);
  } catch (error) {
    logger.error('Failed to process WhatsApp webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function persist(body: WhatsAppWebhookBody): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        if (!message.from) continue;

        // ON CONFLICT DO NOTHING makes a retried delivery a no-op rather than
        // a duplicated conversation.
        await query(
          `INSERT INTO whatsapp_messages
             (phone, provider_message_id, content, message_type, direction, payload, received_at)
           VALUES ($1, $2, $3, $4, 'inbound', $5, to_timestamp($6))
           ON CONFLICT (provider_message_id) DO NOTHING`,
          [
            message.from,
            message.id ?? null,
            message.text?.body ?? null,
            message.type ?? 'text',
            JSON.stringify(message),
            message.timestamp ? Number(message.timestamp) : Math.floor(Date.now() / 1000),
          ],
        );

        logger.info('WhatsApp message received', { messageId: message.id, type: message.type });
      }

      for (const status of change.value?.statuses ?? []) {
        if (!status.id) continue;
        await query(
          `UPDATE whatsapp_messages SET status = $2 WHERE provider_message_id = $1`,
          [status.id, status.status ?? null],
        );
      }
    }
  }
}
