import { z } from 'zod';
import { createRoute, noContent } from '@/lib/http/route';
import { logger } from '@/lib/logger';
import * as analytics from '@/lib/repositories/analytics';

/**
 * POST /api/analytics/pageview — first-party page-view beacon.
 *
 * The client IP is truncated before storage (see lib/privacy.ts), so this
 * records traffic shape without building a per-visitor profile. A failure here
 * must never surface to the visitor, so the response is 204 either way.
 */
export default createRoute({
  POST: {
    body: z.object({
      path: z.string().min(1).max(512),
      referrer: z.string().max(512).optional(),
      // Opaque per-visit identifier generated client-side; not linked to a
      // person and not persisted beyond the 30-day retention window.
      sessionId: z.string().max(64).optional(),
    }),
    rateLimit: { bucket: 'analytics', windowSeconds: 60, max: 120 },
    csrf: false,
    handler: async ({ body, ip, userAgent, auth }) => {
      try {
        await analytics.recordPageView({
          pagePath: body.path,
          referrer: body.referrer ?? null,
          sessionId: body.sessionId ?? null,
          userAgent,
          ipAddress: ip,
          userId: auth?.userId ?? null,
        });
      } catch (error) {
        logger.warn('Failed to record page view', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return noContent();
    },
  },
});
