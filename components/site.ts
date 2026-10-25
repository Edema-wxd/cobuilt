/**
 * Shared site chrome data.
 *
 * Navigation hrefs are root-absolute (`/projects`, not `projects`) so the same
 * header works on the landing page and on the standalone pages beneath it.
 * Every header link resolves to a page of its own; the pages that once pointed
 * at a homepage anchor now exist. See docs/decisions.md §2.13.
 */

export const PHONE = '+234 700 262 8458';
export const PHONE_HREF = 'tel:+2347002628458';
export const EMAIL = 'hello@cobuiltpartners.com';
/** The same line as `PHONE`, in the digits-only form wa.me requires. */
export const WHATSAPP_HREF = 'https://wa.me/2347002628458';

export const ADDRESS_LINES = [
  '27 Apex Drive, TechZone District',
  'Victoria Heights, Lagos',
  'Mon–Fri, 08:00–17:00 WAT',
];

export interface NavItem {
  label: string;
  href: string;
}

/**
 * The header navigation. Media, Careers and Contact are left out of the header;
 * Contact stays reachable through the "Discuss your project" button.
 */
export const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Leadership', href: '/leadership' },
  { label: 'Services', href: '/services' },
  { label: 'Projects', href: '/projects' },
  { label: 'Passport™', href: '/passport' },
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
      { label: 'About', href: '/about' },
      { label: 'Leadership', href: '/leadership' },
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
      { label: 'Project Passport™', href: '/passport' },
    ],
  },
  {
    head: 'Resources',
    items: [
      { label: 'News & insights', href: '/news' },
      { label: 'Video library', href: '/leadership#video-library' },
      { label: 'Downloads' },
      { label: 'FAQs', href: '/faqs' },
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
 * The per-project record at `/projects/[slug]/passport`, which is the page the
 * brief rests on. Until it was built this resolved to the passport summary
 * band on the project page so that no Passport link 404'd; that stopgap is
 * gone. `/passport` — the page that explains what a Passport is — is a
 * different thing, and is where the nav and footer entries point.
 */
export function passportHref(slug: string): string {
  return `/projects/${slug}/passport`;
}
