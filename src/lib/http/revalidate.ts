import type { NextApiResponse } from 'next';
import { logger } from '../logger';

/**
 * Asks the running Next.js server to regenerate pages after a console write
 * (docs/decisions.md §2.19: `res.revalidate` works from a pages API route for
 * an App Router page). Best-effort: it is not there outside a running server
 * (tests, scripts), and a failure only means the page refreshes on its own
 * one-minute `revalidate` schedule. Resolves true when every path was
 * regenerated.
 */
export async function revalidatePages(res: NextApiResponse, paths: readonly string[]): Promise<boolean> {
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        await res.revalidate(path);
        return true;
      } catch (error) {
        logger.warn('Page revalidation failed; it refreshes within a minute', {
          path,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }),
  );
  return results.every(Boolean);
}
