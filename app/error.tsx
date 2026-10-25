'use client';

import { useEffect } from 'react';
import PageHero from '../components/PageHero';
import SiteLayout from '../components/SiteLayout';
import { EMAIL } from '../components/site';
import { btnOrange, btnOutlineOnDark } from '../components/ui';

/**
 * The 500 page: shown when a route throws while rendering. The header and
 * footer stay, so a visitor can navigate away rather than reach a dead end.
 * Root-layout failures fall through to `global-error.tsx`.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SiteLayout>
      <main>
        <PageHero
          eyebrow="Error 500"
          title={
            <>
              Something went wrong <em>on our side</em>.
            </>
          }
          standfirst={`This page failed to load. Trying again often clears it; if it does not, write to ${EMAIL} and we will look into it.`}
          actions={
            <>
              <button type="button" className={btnOrange} onClick={reset}>
                Try again
              </button>
              <a className={btnOutlineOnDark} href="/">
                Back to home
              </a>
            </>
          }
          {...(error.digest ? { meta: `Reference ${error.digest}` } : {})}
        />
      </main>
    </SiteLayout>
  );
}
