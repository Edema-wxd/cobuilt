import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { AuthFrame, link } from '../auth-frame';
import SignInForm from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

// The register link follows ALLOW_PUBLIC_REGISTRATION as it is now, not as it
// was at build time.
export const dynamic = 'force-dynamic';

/** The front door for every account; Phase 1 accounts are all admin-surface. */
export default function SignInPage() {
  return (
    <AuthFrame
      footer={
        env.ALLOW_PUBLIC_REGISTRATION ? (
          <>
            Setting up a new environment?{' '}
            <a className={link} href="/admin/register">
              Create the first account
            </a>
          </>
        ) : undefined
      }
    >
      <SignInForm />
    </AuthFrame>
  );
}
