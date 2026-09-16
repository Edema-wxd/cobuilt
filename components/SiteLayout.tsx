import type { ReactNode } from 'react';
import Head from 'next/head';
import CookieBanner from './CookieBanner';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

interface Props {
  title: string;
  description: string;
  /** href of the nav item to mark current. */
  current?: string;
  /**
   * Hero image to preload. A CSS background is discovered late, which on a
   * photographic hero makes it the LCP element; preloading it closes that gap.
   */
  preloadImage?: string;
  children: ReactNode;
}

/** Header, footer, legal bar and cookie banner, shared by every page. */
export default function SiteLayout({
  title,
  description,
  current,
  preloadImage,
  children,
}: Props) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1c1c1c" />
        {preloadImage ? (
          <link rel="preload" as="image" href={preloadImage} fetchPriority="high" />
        ) : null}
      </Head>

      <SiteHeader {...(current ? { current } : {})} />
      {children}
      <SiteFooter />
      <CookieBanner />
    </>
  );
}
