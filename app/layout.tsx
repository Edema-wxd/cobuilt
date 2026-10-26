import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';

/**
 * Root layout — replaces the former `pages/_app.tsx` and `pages/_document.tsx`.
 *
 * Typefaces are loaded with a plain stylesheet link rather than `next/font` so
 * that a build without network access still succeeds — the stacks in
 * `styles/globals.css` fall back to system faces.
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
