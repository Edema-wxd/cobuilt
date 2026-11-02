import type { Metadata } from 'next';
import { AuthFrame, link } from '../auth-frame';
import SignUpForm from './sign-up-form';

export const metadata: Metadata = {
  title: 'Create your account',
  robots: { index: false, follow: false },
};

/**
 * Where an invited person sets their password. Anyone can complete the form —
 * Neon Auth hosts the identity — but only an address an administrator invited
 * (see /admin/users/new) is linked to a role; everyone else is turned away at
 * the API. The first administrator in a fresh environment is invited with
 * `npm run user:invite-admin`.
 */
export default function RegisterPage() {
  return (
    <AuthFrame
      footer={
        <>
          Already have an account?{' '}
          <a className={link} href="/admin/sign-in">
            Sign in
          </a>
        </>
      }
    >
      <SignUpForm />
    </AuthFrame>
  );
}
