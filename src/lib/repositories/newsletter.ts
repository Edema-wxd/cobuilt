import { query, queryOne } from '../db';
import { generateToken, hashToken } from '../auth/password';

/** Newsletter subscription with double opt-in. */

export interface SubscriberRow {
  id: string;
  email: string;
  full_name: string | null;
  confirmed_at: Date | null;
  unsubscribed_at: Date | null;
  unsubscribe_token: string;
  subscribed_at: Date;
}

export type SubscribeOutcome =
  | { status: 'pending_confirmation'; confirmationToken: string; subscriber: SubscriberRow }
  | { status: 'already_subscribed'; subscriber: SubscriberRow };

/**
 * Idempotent subscribe.
 *
 * A repeat submission for a confirmed address is a no-op rather than an error:
 * telling an anonymous caller that an address is already on the list would
 * turn the form into a membership oracle.
 */
export async function subscribe(input: {
  email: string;
  fullName?: string | null;
  source?: string | null;
  ipAddress?: string | null;
}): Promise<SubscribeOutcome> {
  const existing = await queryOne<SubscriberRow>(
    `SELECT id, email, full_name, confirmed_at, unsubscribed_at, unsubscribe_token, subscribed_at
       FROM newsletter_subscribers WHERE lower(email) = lower($1)`,
    [input.email],
  );

  if (existing && existing.confirmed_at && !existing.unsubscribed_at) {
    return { status: 'already_subscribed', subscriber: existing };
  }

  const { token, hash } = generateToken();

  const subscriber = await queryOne<SubscriberRow>(
    `INSERT INTO newsletter_subscribers (email, full_name, source, ip_address, confirmation_token_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE
        SET full_name = coalesce(EXCLUDED.full_name, newsletter_subscribers.full_name),
            confirmation_token_hash = EXCLUDED.confirmation_token_hash,
            -- Re-subscribing after unsubscribing clears the opt-out.
            unsubscribed_at = NULL,
            subscribed_at = NOW()
     RETURNING id, email, full_name, confirmed_at, unsubscribed_at, unsubscribe_token, subscribed_at`,
    [input.email, input.fullName ?? null, input.source ?? null, input.ipAddress ?? null, hash],
  );

  return { status: 'pending_confirmation', confirmationToken: token, subscriber: subscriber! };
}

export async function confirm(token: string): Promise<SubscriberRow | null> {
  return queryOne<SubscriberRow>(
    `UPDATE newsletter_subscribers
        SET confirmed_at = NOW(), confirmation_token_hash = NULL
      WHERE confirmation_token_hash = $1
      RETURNING id, email, full_name, confirmed_at, unsubscribed_at, unsubscribe_token, subscribed_at`,
    [hashToken(token)],
  );
}

export async function unsubscribe(token: string): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE newsletter_subscribers
        SET unsubscribed_at = NOW()
      WHERE unsubscribe_token = $1 AND unsubscribed_at IS NULL`,
    [token],
  );
  return rowCount > 0;
}

export async function countActive(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM newsletter_subscribers
      WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`,
  );
  return Number(row?.count ?? 0);
}

/** Erases a subscriber outright (NDPA erasure), rather than opting them out. */
export async function deleteByEmail(email: string): Promise<number> {
  const { rowCount } = await query(
    `DELETE FROM newsletter_subscribers WHERE lower(email) = lower($1)`,
    [email],
  );
  return rowCount;
}
