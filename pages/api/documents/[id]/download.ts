import { z } from 'zod';
import { ApiResponse, createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { notFound } from '@/lib/http/errors';
import { logger } from '@/lib/logger';
import * as documents from '@/lib/repositories/documents';

/**
 * GET /api/documents/[id]/download — counts a download, then redirects to the
 * file (302).
 *
 * Download activity is a business metric, so every link to a document on the
 * site goes through here. What is counted is a number: the document's total
 * and the day's count. No IP address, cookie, identifier or user agent is
 * stored; the client IP is only the rate limiter's short-lived Redis key, as
 * on every other endpoint.
 *
 * The response is never cached, by a browser or the CDN, or a repeat download
 * would skip the count. Self-declared crawlers are redirected but not counted.
 * Counting is best-effort: if the write fails the visitor still gets the file.
 */

const params = z.object({ id: z.string().uuid() });

/** User agents that announce themselves as automated. Not a security control. */
const CRAWLER = /bot|crawl|spider|slurp|preview|fetch|monitor|headless|curl|wget|python|java\//i;

function isCrawler(userAgent: string | null): boolean {
  return !userAgent || CRAWLER.test(userAgent);
}

export default createRoute({
  GET: {
    query: params,
    rateLimit: RATE_LIMITS.download,
    handler: async ({ query, userAgent }) => {
      const document = await documents.findDownloadable(query.id);
      if (!document) throw notFound('Document not found');

      if (!isCrawler(userAgent)) {
        await documents.recordDownload(document.id).catch((error: Error) => {
          logger.error('Failed to count a document download', { id: document.id, error: error.message });
        });
      }

      return new ApiResponse(302, null, {
        Location: document.fileUrl,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      });
    },
  },
});
