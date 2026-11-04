import { env } from './env';
import { logger } from './logger';

/**
 * Cloudflare Turnstile, the contact form's CAPTCHA (docs/decisions.md §2.25).
 *
 * A third layer over the honeypot, the heuristic score and Akismet in
 * ./spam.ts — and unlike them it decides before anything is stored. It is
 * inert until `TURNSTILE_SECRET_KEY` is set. Once it is, it fails closed: a
 * missing token, a rejected one, or no answer from Cloudflare all refuse the
 * submission, because a check that lets everything through whenever it is
 * unsure is no check at all.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The `action` the contact form's widget is rendered with; a token for another action is refused. */
export const CONTACT_ACTION = 'contact';

export function isTurnstileEnabled(): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY);
}

/** The public key the widget needs, or null when Turnstile is off. */
export function turnstileSiteKey(): string | null {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? env.TURNSTILE_SITE_KEY ?? null;
}

export type TurnstileOutcome =
  | { ok: true }
  /** Cloudflare looked at the token and refused it. */
  | { ok: false; reason: 'rejected'; errorCodes: string[] }
  /** Cloudflare could not be asked. */
  | { ok: false; reason: 'unavailable' };

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  'error-codes'?: string[];
}

/** Asks Cloudflare whether a widget token is genuine, unused and for this form. */
export async function verifyTurnstile(
  token: string,
  ip: string | null,
  expectedAction: string = CONTACT_ACTION,
): Promise<TurnstileOutcome> {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY ?? '', response: token });
  if (ip) body.set('remoteip', ip);

  let result: SiteverifyResponse;
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`siteverify returned ${response.status}`);
    result = (await response.json()) as SiteverifyResponse;
  } catch (error) {
    logger.warn('Turnstile verification unavailable; refusing the submission', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: 'unavailable' };
  }

  if (!result.success) {
    return { ok: false, reason: 'rejected', errorCodes: result['error-codes'] ?? [] };
  }
  // A token minted for another form is not one for this form. (Cloudflare's
  // test keys return no action, so only a named, different one is refused.)
  if (result.action && result.action !== expectedAction) {
    return { ok: false, reason: 'rejected', errorCodes: ['action-mismatch'] };
  }
  return { ok: true };
}
