import type { NextApiResponse } from 'next';
import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { homepageSettingsBody, type HomepageSettings } from '@/lib/schemas/settings';
import * as siteSettings from '@/lib/repositories/siteSettings';
import * as projects from '@/lib/repositories/projects';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/settings/homepage — the landing page's editable content.
 *   GET — the stored settings, plus the figures the page computes for itself,
 *         so the form can show what an override would replace
 *   PUT — replace the settings (the whole document; null means "as built")
 *
 * Admin only, behind `settings:write`. Every save is audited with the fields
 * it changed. The page regenerates at most once a minute (`revalidate` in
 * app/page.tsx); a save also asks Next.js to regenerate it at once, which is
 * best-effort — the minute is the guarantee.
 */

function view(stored: siteSettings.StoredHomepageSettings, computed: projects.PortfolioCounts) {
  return {
    settings: stored.settings,
    computed,
    updatedAt: stored.updatedAt ? new Date(stored.updatedAt).toISOString() : null,
    updatedBy: stored.updatedByName,
  };
}

/** The top-level fields whose value differs, before and after, for the audit entry. */
function changedFields(before: HomepageSettings, after: HomepageSettings) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of Object.keys(after) as Array<keyof HomepageSettings>) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes[field] = { from: before[field], to: after[field] };
    }
  }
  return changes;
}

/**
 * `res.revalidate` regenerates the cached page in the background. It is not
 * there outside a running Next.js server (tests, scripts), and a failure only
 * means the page refreshes on its normal one-minute schedule.
 */
async function revalidateHomepage(res: NextApiResponse): Promise<boolean> {
  try {
    await res.revalidate('/');
    return true;
  } catch (error) {
    logger.warn('Homepage revalidation failed; it refreshes within a minute', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export default createRoute({
  GET: {
    roles: ['admin'],
    permission: 'settings:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => {
      const [stored, computed] = await Promise.all([
        siteSettings.getHomepageSettings(),
        projects.portfolioCounts(),
      ]);
      return view(stored, computed);
    },
  },

  PUT: {
    body: homepageSettingsBody,
    roles: ['admin'],
    permission: 'settings:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      const before = await siteSettings.getHomepageSettings();
      const saved = await siteSettings.saveHomepageSettings(body, auth!.userId);
      const changes = changedFields(before.settings, saved.settings);

      if (Object.keys(changes).length > 0) {
        await audit.record({
          actorId: auth!.userId,
          actorEmail: auth!.email,
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          entityType: 'site_settings',
          entityId: 'homepage',
          changes,
          ipAddress: ip,
        });
      }

      const revalidated = await revalidateHomepage(res);

      return { ...view(saved, await projects.portfolioCounts()), revalidated };
    },
  },
});
