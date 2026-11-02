import type { LeadershipTier } from '@/types/models';

/** Labels shared by the leadership pages and the console's leadership editor. */

/** The organisational structure, top down. */
export const TIER_ORDER: readonly LeadershipTier[] = ['board', 'executive', 'management'];

export const TIER_LABEL: Record<LeadershipTier, string> = {
  board: 'Board of directors',
  executive: 'Executive leadership',
  management: 'Senior management',
};

export const SOCIAL_LABEL = { linkedin: 'LinkedIn', x: 'X', website: 'Website' } as const;

/**
 * A biography as paragraphs. Editor and CMS text alike: any HTML tags are
 * dropped to their text rather than rendered (the posture of
 * components/ArticleBody.tsx), and blank lines separate paragraphs.
 */
export function bioParagraphs(bio: string | null): string[] {
  if (!bio) return [];
  return bio
    .replace(/<\/(p|div|li)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
