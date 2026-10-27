import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Typefaces are bundled and served from this origin, so no visitor data
// reaches a font CDN and the build needs no network access.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/globals.css';

/**
 * Root layout — replaces the former `pages/_app.tsx` and `pages/_document.tsx`.
 */

/**
 * The absolute origin for Open Graph and canonical URLs. A share preview needs
 * an absolute image URL, and without this Next.js would build it against
 * localhost.
 */
function siteOrigin(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://cobuilt.com');
  } catch {
    return new URL('https://cobuilt.com');
  }
}

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  // Every page sets a bare title ("Cookie Policy") and this appends the house
  // suffix, so the pattern lives in one place. The home and project pages
  // carry their own full titles and set `absolute` to opt out.
  title: {
    default: 'CoBuilt Investment Partners',
    template: '%s — CoBuilt Investment Partners',
  },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1c1c1c',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
