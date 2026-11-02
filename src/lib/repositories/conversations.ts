import { query } from '../db';
import { env } from '../env';

/** WhatsApp messages and live-chat events, retained for RETENTION_MESSAGE_DAYS. */

export async function purgeExpired(): Promise<{ whatsapp: number; chat: number }> {
  const days = env.RETENTION_MESSAGE_DAYS;
  const [whatsapp, chat] = await Promise.all([
    query(`DELETE FROM whatsapp_messages WHERE received_at < NOW() - make_interval(days => $1)`, [
      days,
    ]),
    query(`DELETE FROM chat_events WHERE received_at < NOW() - make_interval(days => $1)`, [days]),
  ]);
  return { whatsapp: whatsapp.rowCount, chat: chat.rowCount };
}
