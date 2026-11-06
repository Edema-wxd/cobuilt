import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Every admin screen — the console and the sign-in, sign-up and reset pages
 * outside it — is kept out of search, including any added later. The response
 * also carries `X-Robots-Tag` (next.config.mjs), which covers what a meta tag
 * cannot: a crawler that never runs the page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
