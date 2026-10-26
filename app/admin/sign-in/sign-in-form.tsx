'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { field, fieldLabel, input } from '../../../components/sections';
import { eyebrow } from '../../../components/ui';
import { ApiFailure, safeReturnPath, signIn } from '../auth-client';

/** `POST /api/auth/login`, shaped to `loginBody` in src/lib/schemas/auth.ts. */
export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setMessage('');

    try {
      await signIn(email, password);
      // Read here rather than through useSearchParams, which would need a
      // Suspense boundary for a value only this handler uses.
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(safeReturnPath(next));
    } catch (failure) {
      setSending(false);
      setPassword('');
      setMessage(
        failure instanceof ApiFailure
          ? failure.message
          : 'No connection to the server. Check your network and try again.',
      );
    }
  }

  return (
    <form
      className="flex flex-col gap-5 border border-zinc-300 bg-white p-6 sm:p-8"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <div className="flex flex-col gap-2">
        <p className={eyebrow}>Admin console</p>
        <h1 className="text-[1.75rem] text-ink">Sign in</h1>
      </div>

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
      </div>

      {/* Charcoal, not white: white on #FF6600 is 2.94:1. */}
      <button
        className="inline-flex min-h-12.5 w-full cursor-pointer items-center justify-center border border-transparent bg-orange px-7 text-[0.719rem] font-semibold tracking-[0.16em] text-ink uppercase transition-colors duration-150 enabled:hover:bg-orange-lift disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={sending}
      >
        {sending ? 'Signing in…' : 'Sign in'}
      </button>

      {message ? (
        <p className="text-[0.781rem] font-medium text-msg-bad" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
