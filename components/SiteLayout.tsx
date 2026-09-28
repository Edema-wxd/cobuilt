import type { ReactNode } from 'react';
import CookieBanner from './CookieBanner';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

interface Props {
  /** href of the nav item to mark current. */
  current?: string;
  /**
   * Hero image to preload. A CSS background is discovered late, which on a
   * photographic hero makes it the LCP element; preloading it closes that gap.
   * React hoists this link into the document head.
   */
  preloadImage?: string;
  children: ReactNode;
}

/**
 * Header, footer, legal bar and cookie banner, shared by every page.
 *
 * Title and description are no longer props: each page exports `metadata`
 * (or `generateMetadata`) instead, which is what puts them in the head.
 */
export default function SiteLayout({ current, preloadImage, children }: Props) {
  return (
    <>
      {preloadImage ? (
        <link rel="preload" as="image" href={preloadImage} fetchPriority="high" />
      ) : null}

      <SiteHeader {...(current ? { current } : {})} />
      {children}
      <SiteFooter />
      <CookieBanner />
    </>
  );
}
