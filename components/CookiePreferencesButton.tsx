'use client';

import { openPreferences } from './cookieConsent';
import * as prose from './prose';

/**
 * The one interactive control on the cookie policy page. It is split out so
 * that the page itself stays a server component.
 */
export default function CookiePreferencesButton() {
  return (
    <button className={prose.action} type="button" onClick={openPreferences}>
      Change cookie preferences
    </button>
  );
}
