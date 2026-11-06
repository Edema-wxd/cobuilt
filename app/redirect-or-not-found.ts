import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { after } from 'next/server';
import type { RedirectRule } from '@/lib/redirects';

/**
 * The 404 path, with the console's redirects in front of it
 * (docs/decisions.md §2.27). A rule at `/admin/redirects` sends a visitor on
 * (308 permanent, 307 temporary) only from an address that has nothing to
 * show, so a live page is never redirected.
 *
 * The hit is counted after the response has gone, so the visitor never waits
 * on the write. A failed lookup is the 404 the visitor would have had anyway,
 * never an error page.
 */

/** The rule for a path, or null — including when the lookup cannot run at all. */
async function ruleFor(path: string): Promise<RedirectRule | null> {
  try {
    const { findRedirect } = await import('@/lib/redirects');
    return await findRedirect(path);
  } catch (error) {
    // Reached only if the module itself cannot load (configuration missing).
    const { logger } = await import('@/lib/logger');
    logger.warn('Redirect lookup unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function sendOn(rule: RedirectRule): never {
  after(async () => {
    const { recordHit } = await import('@/lib/redirects');
    await recordHit(rule);
  });
  if (rule.permanent) permanentRedirect(rule.destination);
  redirect(rule.destination);
}

/**
 * For a page that has found nothing to show, in place of `notFound()`:
 * redirected when the address has a rule, the 404 otherwise.
 * `app/[...path]/page.tsx` does the same for an address no route matches.
 */
export async function redirectOrNotFound(path: string): Promise<never> {
  const rule = await ruleFor(path);
  if (!rule) notFound();
  sendOn(rule);
}

/**
 * For a layout above a `loading.tsx` (a project, its Passport™ record, an
 * article). Those pages stream: the loading state goes out, with a 200, before
 * the page knows its slug is unknown, so a redirect thrown from the page can
 * only reach the browser as an in-page refresh. The layout renders before the
 * loading state, so a redirect from here is a real 308 or 307.
 *
 * Costs a lookup in the in-memory map per request and nothing more: only
 * when the address has a rule is the content loaded (`isGone`, a cached
 * loader the page then reuses) to make sure the page really is gone.
 */
export async function redirectIfGone(path: string, isGone: () => Promise<boolean>): Promise<void> {
  const rule = await ruleFor(path);
  if (!rule || !(await isGone())) return;
  sendOn(rule);
}
