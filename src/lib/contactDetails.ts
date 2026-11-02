import type { ContactSettings } from './schemas/settings';
import { ADDRESS_LINES, EMAIL, OFFICE_LOCATION, PHONE, WHATSAPP_HREF } from '../../components/site';

/**
 * The contact details as built, and the links made from them.
 *
 * `components/site.ts` holds the office's phone, email, WhatsApp link and
 * address as constants. The contact page, header, footer and landing page now
 * read the console's `contact` settings instead (docs/decisions.md §2.25,
 * `components/ContactDetails.tsx`), and these constants are their fallback: a key
 * never saved, or no database, shows exactly the details the site launched
 * with. Kept free of Zod so the console's client code can use the link
 * builders.
 */

/**
 * The number behind a wa.me link, as a person reads it: the office line's own
 * spacing when it is the same number ("+234 700 262 8458"), otherwise "+" and
 * the digits.
 */
function whatsappNumber(href: string): string | null {
  const digits = /wa\.me\/(\d+)/.exec(href)?.[1];
  if (!digits) return null;
  return PHONE.replace(/\D/g, '') === digits ? PHONE : `+${digits}`;
}

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  // ADDRESS_LINES ends with the hours, which are their own field here.
  addressLines: ADDRESS_LINES.filter((line) => !/\d{2}:\d{2}/.test(line)),
  phones: [{ label: 'Office', number: PHONE }],
  emails: [{ label: 'General enquiries', address: EMAIL }],
  whatsapp: whatsappNumber(WHATSAPP_HREF),
  hours: [{ days: 'Monday to Friday', hours: '08:00–17:00 WAT' }],
  location: OFFICE_LOCATION,
};

/** `tel:+2347002628458` from "+234 700 262 8458". */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

/** `https://wa.me/2347002628458`: wa.me takes the international number as digits only. */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}

/** "Monday to Friday, 08:00–17:00 WAT; Saturday, by appointment". */
export function hoursText(hours: ContactSettings['hours']): string {
  return hours.map((entry) => `${entry.days}, ${entry.hours}`).join('; ');
}
