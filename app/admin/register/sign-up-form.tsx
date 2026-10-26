'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { field, fieldLabel, input } from '../../../components/sections';
import {
  ApiFailure,
  sendVerificationCode,
  signUp,
  verifyEmail,
} from '../auth-client';
import { CardHead, card, errorText, hint, lead, link, submitButton } from '../auth-frame';

/** Matches Neon Auth's default minimum, so the browser says it before the server does. */
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const OFFLINE = 'No connection to the server. Check your network and try again.';

/**
 * Creates the Neon Auth identity, then confirms the address with an emailed
 * code. Signing up grants nothing on its own: the account an administrator
 * created for this address (or, on a fresh environment, the bootstrap rule)
 * supplies the role when the two are linked after verification.
 */
export default function SignUpForm() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [resent, setResent] = useState(false);

  function fail(failure: unknown): void {
    setMessage(failure instanceof ApiFailure ? failure.message : OFFLINE);
  }

  async function submitDetails(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setMessage('');
    try {
      await signUp({ fullName, email, password });
      setStep('code');
    } catch (failure) {
      fail(failure);
    } finally {
      setSending(false);
    }
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setMessage('');
    try {
      await verifyEmail(email, code.trim());
      router.replace('/admin');
    } catch (failure) {
      setSending(false);
      fail(failure);
    }
  }

  async function resend(): Promise<void> {
    setMessage('');
    try {
      await sendVerificationCode(email);
      setResent(true);
    } catch (failure) {
      fail(failure);
    }
  }

  if (step === 'code') {
    return (
      <form
        className={card}
        onSubmit={(event) => {
          void submitCode(event);
        }}
      >
        <CardHead label="CoBuilt account" title="Check your email" />
        <p className={lead}>
          We sent a code to <strong>{email}</strong>. Enter it to confirm the address and finish
          creating your account.
        </p>

        <div className={field}>
          <label className={fieldLabel} htmlFor="signup-code">
            Code
          </label>
          <input
            id="signup-code"
            className={input}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <p className={hint}>
            {resent ? 'A new code is on its way. ' : 'Nothing yet? '}
            <button
              className={link}
              type="button"
              onClick={() => {
                void resend();
              }}
            >
              Send it again
            </button>
          </p>
        </div>

        <button className={submitButton} type="submit" disabled={sending}>
          {sending ? 'Confirming…' : 'Confirm and continue'}
        </button>

        {message ? (
          <p className={errorText} role="alert">
            {message}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form
      className={card}
      onSubmit={(event) => {
        void submitDetails(event);
      }}
    >
      <CardHead label="CoBuilt account" title="Create your password" />
      <p className={lead}>
        Use the email address your administrator invited. If it was not invited, you will be able to
        verify it but not sign in to the console.
      </p>

      <div className={field}>
        <label className={fieldLabel} htmlFor="signup-name">
          Full name
        </label>
        <input
          id="signup-name"
          className={input}
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={255}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="signup-email">
          Email address
        </label>
        <input
          id="signup-email"
          className={input}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
          className={input}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          maxLength={MAX_PASSWORD}
          aria-describedby="signup-password-hint"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p id="signup-password-hint" className={hint}>
          At least {MIN_PASSWORD} characters. A short phrase is easier to remember than symbols.
        </p>
      </div>

      <button className={submitButton} type="submit" disabled={sending}>
        {sending ? 'Creating…' : 'Create account'}
      </button>

      {message ? (
        <p className={errorText} role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
