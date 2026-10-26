import type { Metadata } from 'next';
import { AuthFrame, link } from '../auth-frame';
import ForgotPasswordForm from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      footer={
        <>
          Remembered it?{' '}
          <a className={link} href="/admin/sign-in">
            Back to sign in
          </a>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
