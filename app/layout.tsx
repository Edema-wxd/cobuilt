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

/**
 * Runs before first paint: the brand mark in components/BrandIntro.tsx plays
 * on the first page of a visit only, so every later page is marked as seen
 * before it can show. Storage can throw (private modes, blocked cookies); the
 * mark then simply plays again, which is harmless.
 */
const INTRO_SCRIPT = `try{var s=window.sessionStorage;if(s.getItem('cb-intro')){document.documentElement.classList.add('intro-seen')}else{s.setItem('cb-intro','1')}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The intro script adds a class to <html> before React hydrates it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
        <noscript>
          <style>{'.brand-intro{display:none}html{--intro-offset:0ms}'}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
