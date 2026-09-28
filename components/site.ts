/**
 * Shared site chrome data.
 *
 * Navigation hrefs are root-absolute (`/#about`, not `#about`) so the same
 * header works on the landing page and on the standalone pages beneath it.
 */

export const PHONE = '+234 700 262 8458';
export const PHONE_HREF = 'tel:+2347002628458';
export const EMAIL = 'hello@cobuiltpartners.com';

export const ADDRESS_LINES = [
  '27 Apex Drive, TechZone District',
  'Victoria Heights, Lagos',
  'Mon–Fri, 08:00–17:00 WAT',
];

export interface NavItem {
  label: string;
  href: string;
}

/** The nine-item global navigation the standards document mandates. */
export const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/#about' },
  { label: 'Leadership', href: '/#leadership' },
  { label: 'Services', href: '/#services' },
  { label: 'Projects', href: '/projects' },
  { label: 'Passport™', href: '/#passport' },
  { label: 'Media', href: '/#media' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/#register' },
];

export interface FooterItem {
  label: string;
  /** Omitted while the page behind the entry does not exist yet. */
  href?: string;
  /** Renders as a button that reopens the cookie preferences panel. */
  action?: 'cookie-preferences';
}

export const FOOTER_COLUMNS: Array<{ head: string; items: FooterItem[] }> = [
  {
    head: 'Company',
    items: [
      { label: 'About', href: '/#about' },
      { label: 'Leadership', href: '/#leadership' },
      { label: 'Governance' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    head: 'Projects',
    items: [
      { label: 'Past projects', href: '/projects?status=completed' },
      { label: 'Ongoing projects', href: '/projects?status=ongoing' },
      { label: 'Future projects', href: '/projects?status=future' },
      { label: 'Project Passport™', href: '/#passport' },
    ],
  },
  {
    head: 'Resources',
    items: [
      { label: 'News & insights', href: '/#media' },
      { label: 'Video library', href: '/#leadership' },
      { label: 'Downloads' },
      { label: 'FAQs' },
    ],
  },
  {
    head: 'Legal',
    items: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Accessibility Statement', href: '/accessibility' },
      { label: 'Cookie preferences', action: 'cookie-preferences' },
    ],
  },
];

/**
 * Where a Project Passport™ link goes.
 *
 * The Passport page itself — `/projects/[slug]/passport` — is not built yet
 * (docs/design-handover.md §3.1). Until it is, every Passport link resolves to
 * the passport summary band on the project page rather than to a 404. This is
 * the one place to change when that page ships.
 */
export function passportHref(slug: string): string {
  return `/projects/${slug}#passport`;
}
