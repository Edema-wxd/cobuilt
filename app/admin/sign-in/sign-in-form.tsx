'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { field, fieldLabel, input } from '../../../components/sections';
import {
  ApiFailure,
  VerificationRequired,
  safeReturnPath,
  sendVerificationCode,
  signIn,
  verifyEmail,
} from '../auth-client';
import { CardHead, card, errorText, hint, link, okText, submitButton } from '../auth-frame';

/** What the page that sent the user here wants them told. */
const NOTICES: Record<string, string> = {
  reset: 'Your password has been changed. Sign in with the new one.',
  deleted: 'Your account and its personal data have been deleted.',
};

/**
 * Signs in with Neon Auth. An address that was never verified is asked for the
 * emailed code first; Neon Auth sends it as the sign-in is refused.
 */
export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    // Read here rather than through useSearchParams, which would need a
    // Suspense boundary for a value read once.
    const from = new URLSearchParams(window.location.search).get('done');
    setNotice(from ? (NOTICES[from] ?? '') : '');
  }, []);

  function enter(): void {
    const next = new URLSearchParams(window.location.search).get('next');
    router.replace(safeReturnPath(next));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setMessage('');
    setNotice('');

    try {
      if (needsCode) await verifyEmail(email, code.trim());
      else await signIn(email, password);
      enter();
    } catch (failure) {
      setSending(false);
      if (failure instanceof VerificationRequired) {
        setNeedsCode(true);
        setNotice(`Your email address is not verified yet. We sent a code to ${email}.`);
        return;
      }
      if (!needsCode) setPassword('');
      setMessage(
        failure instanceof ApiFailure
          ? failure.message
          : 'No connection to the server. Check your network and try again.',
      );
    }
  }

  async function resend(): Promise<void> {
    setMessage('');
    try {
      await sendVerificationCode(email);
      setNotice(`A new code is on its way to ${email}.`);
    } catch (failure) {
      setMessage(failure instanceof ApiFailure ? failure.message : 'Could not send the code.');
    }
  }

  return (
    <form
      className={card}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <CardHead label="CoBuilt account" title="Sign in" />

      {notice ? (
        <p className={okText} role="status">
          {notice}
        </p>
      ) : null}

      <div className={field}>
        <label className={fieldLabel} htmlFor="signin-email">
          Email address
        </label>
        <input
          id="signin-email"
          className={input}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      {needsCode ? (
        <div className={field}>
          <label className={fieldLabel} htmlFor="signin-code">
            Verification code
          </label>
          <input
            id="signin-code"
            className={input}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <p className={hint}>
            <button
              className={link}
              type="button"
              onClick={() => {
                void resend();
              }}
            >
              Send the code again
            </button>
          </p>
        </div>
      ) : (
      <div className={field}>
        <label className={fieldLabel} htmlFor="signin-password">
          Password
        </label>
        <input
          id="signin-password"
          className={input}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className={hint}>
          <a className={link} href="/admin/forgot-password">
            Forgot your password?
          </a>
        </p>
      </div>
      )}

      <button className={submitButton} type="submit" disabled={sending}>
        {sending ? 'Signing in…' : needsCode ? 'Verify and sign in' : 'Sign in'}
      </button>

      {message ? (
        <p className={errorText} role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
