'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { field, fieldLabel, input } from '../../../components/sections';
import { ApiFailure, requestPasswordReset, resetPassword } from '../auth-client';
import { CardHead, card, errorText, hint, lead, link, okText, submitButton } from '../auth-frame';

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Two steps on one page. Neon Auth emails a six-digit code to the address
 * (answering the same whether or not it has an account, so this form never
 * says which); the code and a new password then go back to Neon Auth.
 */
export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // The account page sends the code itself and links here to finish.
    const params = new URLSearchParams(window.location.search);
    const known = params.get('email');
    if (known && params.get('step') === 'code') {
      setEmail(known);
      setStep('code');
    }
  }, []);

  function fail(failure: unknown): void {
    setMessage(
      failure instanceof ApiFailure
        ? failure.message
        : 'No connection to the server. Check your network and try again.',
    );
  }

  async function sendCode(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setMessage('');
    try {
      const result = await requestPasswordReset(email);
      setSent(result.message);
      setStep('code');
    } catch (failure) {
      fail(failure);
    } finally {
      setSending(false);
    }
  }

  async function finish(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (password !== confirm) {
      setMessage('The two passwords do not match.');
      return;
    }
    setSending(true);
    setMessage('');
    try {
      await resetPassword(email, code.trim(), password);
      router.replace('/admin/sign-in?done=reset');
    } catch (failure) {
      setSending(false);
      fail(failure);
    }
  }

  if (step === 'code') {
    return (
      <form
        className={card}
        onSubmit={(event) => {
          void finish(event);
        }}
      >
        <CardHead label="Password reset" title="Enter the code" />
        {sent ? (
          <p className={okText} role="status">
            {sent}
          </p>
        ) : null}
        <p className={lead}>
          Enter the code we emailed to <strong>{email || 'your address'}</strong> and choose a new
          password. It is valid for a few minutes.
        </p>

        {email ? null : (
          <div className={field}>
            <label className={fieldLabel} htmlFor="forgot-email-2">
              Email address
            </label>
            <input
              id="forgot-email-2"
              className={input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        )}

        <div className={field}>
          <label className={fieldLabel} htmlFor="reset-code">
            Code
          </label>
          <input
            id="reset-code"
            className={input}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>

        <div className={field}>
          <label className={fieldLabel} htmlFor="reset-password">
            New password
          </label>
          <input
            id="reset-password"
            className={input}
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            maxLength={MAX_LENGTH}
            aria-describedby="reset-password-hint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id="reset-password-hint" className={hint}>
            At least {MIN_LENGTH} characters. A short phrase is easier to remember than symbols.
          </p>
        </div>

        <div className={field}>
          <label className={fieldLabel} htmlFor="reset-confirm">
            Confirm new password
          </label>
          <input
            id="reset-confirm"
            className={input}
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        <button className={submitButton} type="submit" disabled={sending}>
          {sending ? 'Saving…' : 'Set new password'}
        </button>

        {message ? (
          <p className={errorText} role="alert">
            {message}{' '}
            <button
              className={link}
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setMessage('');
              }}
            >
              Request a new code
            </button>
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form
      className={card}
      onSubmit={(event) => {
        void sendCode(event);
      }}
    >
      <CardHead label="Password reset" title="Forgot your password?" />
      <p className={lead}>Enter your account&rsquo;s email address and we will send a reset code.</p>

      <div className={field}>
        <label className={fieldLabel} htmlFor="forgot-email">
          Email address
        </label>
        <input
          id="forgot-email"
          className={input}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <button className={submitButton} type="submit" disabled={sending}>
        {sending ? 'Sending…' : 'Send reset code'}
      </button>

      {message ? (
        <p className={errorText} role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
