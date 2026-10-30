import { query, queryOne, transaction } from '../db';

/**
 * Subject access and erasure for people who contacted CoBuilt without an
 * account (NDPA). Account holders use /api/users/[userId]/export and DELETE.
 *
 * A person is identified by email, phone, or both. Phone numbers are compared
 * on digits only, and a Nigerian number matches in both its local (0801...)
 * and international (234801...) forms, because WhatsApp reports the latter
 * while people type the former into forms.
 */

export interface SubjectIdentifiers {
  email?: string | null;
  phone?: string | null;
}

export function phoneVariants(phone: string | null | undefined): string[] {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  if (!digits) return [];
  if (digits.startsWith('234') && digits.length > 3) return [digits, `0${digits.slice(3)}`];
  if (digits.startsWith('0') && digits.length > 1) return [digits, `234${digits.slice(1)}`];
  return [digits];
}

const FORM_MATCH = `anonymised_at IS NULL
  AND (lower(email) = lower($1) OR regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ANY($2::text[]))`;

function params(ids: SubjectIdentifiers): [string | null, string[]] {
  return [ids.email ?? null, phoneVariants(ids.phone)];
}

export async function findAccount(
  email: string | null | undefined,
): Promise<{ id: string; role: string } | null> {
  if (!email) return null;
  return queryOne<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [email],
  );
}

export async function exportData(ids: SubjectIdentifiers) {
  const [email, phones] = params(ids);

  const [submissions, newsletter, chat, whatsapp] = await Promise.all([
    query(
      `SELECT id, form_type, name, email, phone, message, metadata,
              host(ip_address) AS ip_address, user_agent, submitted_at, retain_until
         FROM form_submissions WHERE ${FORM_MATCH} ORDER BY submitted_at DESC`,
      [email, phones],
    ),
    query(
      `SELECT email, full_name, source, host(ip_address) AS ip_address,
              confirmed_at, unsubscribed_at, subscribed_at
         FROM newsletter_subscribers WHERE lower(email) = lower($1)`,
      [email],
    ),
    query(
      `SELECT conversation_id, event_type, contact_email, contact_name, content, received_at
         FROM chat_events WHERE lower(contact_email) = lower($1) ORDER BY received_at DESC`,
      [email],
    ),
    query(
      `SELECT phone, content, message_type, direction, status, received_at
         FROM whatsapp_messages
        WHERE regexp_replace(phone, '\\D', '', 'g') = ANY($1::text[])
        ORDER BY received_at DESC`,
      [phones],
    ),
  ]);

  return {
    formSubmissions: submissions.rows,
    newsletter: newsletter.rows,
    chatEvents: chat.rows,
    whatsappMessages: whatsapp.rows,
  };
}

export interface ErasureCounts {
  submissionsAnonymised: number;
  newsletterRemoved: number;
  chatEventsDeleted: number;
  whatsappMessagesDeleted: number;
}

/** Erases everything held for the subject in one transaction. */
export async function erase(ids: SubjectIdentifiers): Promise<ErasureCounts> {
  const [email, phones] = params(ids);

  return transaction(async (client) => {
    const submissions = await client.query(
      `UPDATE form_submissions
          SET name = NULL, email = NULL, phone = NULL, message = NULL,
              ip_address = NULL, user_agent = NULL, metadata = '{}'::jsonb,
              anonymised_at = NOW()
        WHERE ${FORM_MATCH}`,
      [email, phones],
    );
    const newsletter = await client.query(
      `DELETE FROM newsletter_subscribers WHERE lower(email) = lower($1)`,
      [email],
    );
    const chat = await client.query(
      `DELETE FROM chat_events WHERE lower(contact_email) = lower($1)`,
      [email],
    );
    const whatsapp = await client.query(
      `DELETE FROM whatsapp_messages
        WHERE regexp_replace(phone, '\\D', '', 'g') = ANY($1::text[])`,
      [phones],
    );

    return {
      submissionsAnonymised: submissions.rowCount ?? 0,
      newsletterRemoved: newsletter.rowCount ?? 0,
      chatEventsDeleted: chat.rowCount ?? 0,
      whatsappMessagesDeleted: whatsapp.rowCount ?? 0,
    };
  });
}
