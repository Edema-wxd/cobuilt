import { createRoute } from '@/lib/http/route';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { revalidatePages } from '@/lib/http/revalidate';
import { contactSettingsBody, type ContactSettings } from '@/lib/schemas/settings';
import * as siteSettings from '@/lib/repositories/siteSettings';
import * as audit from '@/lib/repositories/audit';
import { AUDIT_ACTIONS } from '@/lib/repositories/audit';

/**
 * /api/admin/settings/contact — the contact page's details.
 *   GET — the stored details, or the details as built when never saved
 *   PUT — replace them (the whole document)
 *
 * Office address, phone numbers, email addresses, the WhatsApp Business
 * number, business hours and the map position. Admin only, behind
 * `settings:write`, like the homepage's settings; every save is audited with
 * the fields it changed. `/contact` regenerates at most once a minute; a save
 * also asks Next.js to regenerate it at once, which is best-effort.
 *
 * The header and footer still read components/site.ts, not this document
 * (docs/decisions.md §2.25).
 */

function view(stored: siteSettings.StoredContactSettings) {
  return {
    settings: stored.settings,
    updatedAt: stored.updatedAt ? new Date(stored.updatedAt).toISOString() : null,
    updatedBy: stored.updatedByName,
  };
}

/** The top-level fields whose value differs, before and after, for the audit entry. */
function changedFields(before: ContactSettings, after: ContactSettings) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of Object.keys(after) as Array<keyof ContactSettings>) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes[field] = { from: before[field], to: after[field] };
    }
  }
  return changes;
}

export default createRoute({
  GET: {
    roles: ['admin'],
    permission: 'settings:write',
    rateLimit: RATE_LIMITS.api,
    handler: async () => view(await siteSettings.getContactSettings()),
  },

  PUT: {
    body: contactSettingsBody,
    roles: ['admin'],
    permission: 'settings:write',
    rateLimit: RATE_LIMITS.api,
    handler: async ({ body, auth, ip, res }) => {
      const before = await siteSettings.getContactSettings();
      const saved = await siteSettings.saveContactSettings(body, auth!.userId);
      const changes = changedFields(before.settings, saved.settings);

      if (Object.keys(changes).length > 0) {
        await audit.record({
          actorId: auth!.userId,
          actorEmail: auth!.email,
          action: AUDIT_ACTIONS.SETTINGS_UPDATED,
          entityType: 'site_settings',
          entityId: 'contact',
          changes,
          ipAddress: ip,
        });
      }

      const revalidated = await revalidatePages(res, ['/contact']);

      return { ...view(saved), revalidated };
    },
  },
});
