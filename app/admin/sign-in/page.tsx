import type { Metadata } from 'next';
import { AuthFrame } from '../auth-frame';
import SignInForm from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/** The front door for every account; Phase 1 accounts are all admin-surface. */
export default function SignInPage() {
  return (
    <AuthFrame>
      <SignInForm />
    </AuthFrame>
  );
}
