import { env } from './env';
import { logger } from './logger';

/**
 * Spam scoring for public forms (§8).
 *
 * Two layers: a fast local heuristic that runs always, and Akismet when a key
 * is configured. Akismet is advisory — a network failure must not block a
 * legitimate enquiry, so an error there falls back to the heuristic score.
 */

export interface SpamCheckInput {
  name?: string | null;
  email?: string | null;
  content?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  /** Hidden field that only a bot fills in. */
  honeypot?: string | null;
}

export interface SpamCheckResult {
  isSpam: boolean;
  score: number; // 0.00 (clean) .. 1.00 (certain spam)
  reasons: string[];
}

const SPAM_THRESHOLD = 0.7;

const SPAM_PHRASES = [
  'seo services',
  'guest post',
  'backlink',
  'crypto investment',
  'binary options',
  'viagra',
  'casino',
  'loan offer',
  'work from home',
  'click here now',
];

export async function checkSpam(input: SpamCheckInput): Promise<SpamCheckResult> {
  const heuristic = heuristicScore(input);

  // A filled honeypot is conclusive; no need to spend a network call on it.
  if (heuristic.score >= 1) return heuristic;

  if (!env.AKISMET_API_KEY) return heuristic;

  try {
    const akismetSpam = await checkAkismet(input);
    if (akismetSpam) {
      return {
        isSpam: true,
        score: Math.max(0.9, heuristic.score),
        reasons: [...heuristic.reasons, 'akismet'],
      };
    }
    // Akismet clearing a submission lowers, but does not erase, local signals.
    return { ...heuristic, score: Math.min(heuristic.score, 0.5), isSpam: false };
  } catch (error) {
    logger.warn('Akismet check failed; using heuristic score', {
      error: error instanceof Error ? error.message : String(error),
    });
    return heuristic;
  }
}

export function heuristicScore(input: SpamCheckInput): SpamCheckResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { isSpam: true, score: 1, reasons: ['honeypot'] };
  }

  const content = (input.content ?? '').toLowerCase();
  const name = (input.name ?? '').toLowerCase();

  const linkCount = (content.match(/https?:\/\//g) ?? []).length;
  if (linkCount >= 5) {
    score += 0.4;
    reasons.push(`links:${linkCount}`);
  } else if (linkCount >= 2) {
    score += 0.2;
    reasons.push(`links:${linkCount}`);
  }

  const phraseHits = SPAM_PHRASES.filter((phrase) => content.includes(phrase));
  if (phraseHits.length > 0) {
    score += Math.min(0.5, phraseHits.length * 0.25);
    reasons.push(`phrases:${phraseHits.join('|')}`);
  }

  if (content.length > 0) {
    const letters = content.replace(/[^a-z]/g, '').length;
    const uppercase = (input.content ?? '').replace(/[^A-Z]/g, '').length;
    if (letters > 20 && uppercase / (letters + uppercase) > 0.6) {
      score += 0.2;
      reasons.push('shouting');
    }
  }

  // Cyrillic or CJK in a name field on an English-language Nigerian site is a
  // weak signal on its own, so it only nudges the score.
  if (/[\u0400-\u04ff\u4e00-\u9fff]/.test(name)) {
    score += 0.15;
    reasons.push('unexpected-script');
  }

  if (!input.userAgent || input.userAgent.length < 10) {
    score += 0.2;
    reasons.push('missing-user-agent');
  }

  if (content.length > 0 && content.length < 15) {
    score += 0.1;
    reasons.push('very-short');
  }

  const rounded = Math.min(1, Math.round(score * 100) / 100);
  return { isSpam: rounded >= SPAM_THRESHOLD, score: rounded, reasons };
}

async function checkAkismet(input: SpamCheckInput): Promise<boolean> {
  const body = new URLSearchParams({
    blog: env.NEXT_PUBLIC_WEBSITE_URL,
    user_ip: input.ip ?? '',
    user_agent: input.userAgent ?? '',
    referrer: input.referrer ?? '',
    comment_type: 'contact-form',
    comment_author: input.name ?? '',
    comment_author_email: input.email ?? '',
    comment_content: input.content ?? '',
  });

  const response = await fetch(
    `https://${env.AKISMET_API_KEY}.rest.akismet.com/1.1/comment-check`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(3000),
    },
  );

  const text = (await response.text()).trim();
  return text === 'true';
}
