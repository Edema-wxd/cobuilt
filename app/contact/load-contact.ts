import type { ContactSettings } from '@/lib/schemas/settings';
import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contactDetails';

/**
 * The contact page's details, set at `/admin/contact` and read on the server.
 *
 * Never throws: with no database — including a build with none configured —
 * the page shows the details as built (components/site.ts, through
 * DEFAULT_CONTACT_SETTINGS), and the next revalidation picks the console's
 * up. The same posture as `app/home-settings.ts`.
 */
export async function loadContactSettings(): Promise<ContactSettings> {
  try {
    const siteSettings = await import('@/lib/repositories/siteSettings');
    return (await siteSettings.getContactSettings()).settings;
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('Contact settings unavailable; showing the details as built', {
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_CONTACT_SETTINGS;
  }
}
