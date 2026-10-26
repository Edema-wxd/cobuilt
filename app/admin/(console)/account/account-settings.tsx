'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { field, fieldLabel, input } from '../../../../components/sections';
import { ApiFailure, api, requestPasswordReset, signOut } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  Fact,
  PageHeader,
  btnSmall,
  btnSmallDanger,
  formatDateTime,
  muted,
  panel,
  panelHead,
  panelTitle,
} from '../../kit';

/**
 * The signed-in user's own account, and the NDPA rights the privacy policy
 * promises over it (app/privacy/page.tsx, "Your rights"):
 *
 *   access and portability — `GET /api/users/[userId]/export`
 *   erasure                 — `DELETE /api/users/[userId]`
 *
 * This screen renders for every role, including those with no console
 * permission: the rights belong to the person, not to the role.
 */

function describe(failure: unknown): string {
  return failure instanceof ApiFailure ? failure.message : 'No connection to the server.';
}

export default function AccountSettings() {
  const { user } = useSession();

  return (
    <>
      <PageHeader label="Account" title="Your account">
        Your details, a copy of the personal data we hold about you, and the option to delete your
        account — your rights under the Nigeria Data Protection Act, as set out in our{' '}
        <a className="text-rust underline hover:text-rust-hover" href="/privacy">
          Privacy Policy
        </a>
        .
      </PageHeader>

      <div className="flex max-w-3xl flex-col gap-6">
        <section className={panel} aria-labelledby="account-details">
          <div className={panelHead}>
            <h2 id="account-details" className={panelTitle}>
              Details
            </h2>
          </div>
          <dl className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
            <Fact label="Name">{user.fullName}</Fact>
            <Fact label="Email">{user.email}</Fact>
            <Fact label="Role">{user.role[0]!.toUpperCase() + user.role.slice(1)}</Fact>
            <Fact label="Account created">{formatDateTime(user.createdAt)}</Fact>
            <Fact label="Last sign-in">{formatDateTime(user.lastLogin)}</Fact>
          </dl>
          <p className={`border-t border-line px-5 py-4 ${muted}`}>
            To correct your name or email, ask an administrator — or write to us, as the Privacy
            Policy describes.
          </p>
        </section>

        <PasswordPanel email={user.email} />
        <ExportPanel userId={user.id} />
        <DeletePanel userId={user.id} email={user.email} isAdmin={user.role === 'admin'} />
      </div>
    </>
  );
}

/** The reset code is the one path to a new password, and it proves the inbox. */
function PasswordPanel({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function send(): Promise<void> {
    setState('sending');
    setError('');
    try {
      await requestPasswordReset(email);
      setState('sent');
    } catch (failure) {
      setState('idle');
      setError(describe(failure));
    }
  }

  return (
    <section className={panel} aria-labelledby="account-password">
      <div className={panelHead}>
        <h2 id="account-password" className={panelTitle}>
          Password
        </h2>
      </div>
      <div className="flex flex-col items-start gap-4 p-5">
        <p className="text-[0.906rem] leading-[1.7] text-zinc-700">
          We will email a reset code to {email}. Enter it on the next page with a new password.
        </p>
        {state === 'sent' ? (
          <p className="text-[0.875rem] font-medium text-msg-ok" role="status">
            Sent.{' '}
            <a
              className="text-rust underline hover:text-rust-hover"
              href={`/admin/forgot-password?step=code&email=${encodeURIComponent(email)}`}
            >
              Enter the code
            </a>
            .
          </p>
        ) : (
          <button
            className={btnSmall}
            type="button"
            disabled={state === 'sending'}
            onClick={() => {
              void send();
            }}
          >
            {state === 'sending' ? 'Sending…' : 'Email me a reset code'}
          </button>
        )}
        {error ? (
          <p className="text-[0.875rem] text-msg-bad" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ExportPanel({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const data = await api<unknown>(`/api/users/${userId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cobuilt-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      // Revoked on the next tick: revoking during the click can cancel the save.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (failure) {
      setError(describe(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={panel} aria-labelledby="account-export">
      <div className={panelHead}>
        <h2 id="account-export" className={panelTitle}>
          Download your data
        </h2>
      </div>
      <div className="flex flex-col items-start gap-4 p-5">
        <p className="text-[0.906rem] leading-[1.7] text-zinc-700">
          A machine-readable JSON file of everything we hold that is linked to your account: your
          profile, any enquiries sent from your email address, the pages you viewed while signed
          in, your sign-in sessions, and your newsletter subscription.
        </p>
        <button
          className={btnSmall}
          type="button"
          disabled={busy}
          onClick={() => {
            void download();
          }}
        >
          {busy ? 'Preparing…' : 'Download my data'}
        </button>
        {error ? (
          <p className="text-[0.875rem] text-msg-bad" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DeletePanel({
  userId,
  email,
  isAdmin,
}: {
  userId: string;
  email: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function erase(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/users/${userId}`, { method: 'DELETE' });
      // The refresh tokens are already revoked; this clears the cookies too.
      await signOut();
      router.replace('/admin/sign-in?done=deleted');
    } catch (failure) {
      setBusy(false);
      setError(describe(failure));
    }
  }

  return (
    <section className={panel} aria-labelledby="account-delete">
      <div className={panelHead}>
        <h2
          id="account-delete"
          className="text-[0.719rem] font-semibold tracking-[0.16em] text-msg-bad uppercase"
        >
          Delete your account
        </h2>
      </div>
      <div className="flex flex-col items-start gap-4 p-5">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.906rem] leading-[1.7] text-zinc-700">
          <li>Your account is closed and you are signed out on every device.</li>
          <li>Enquiries sent from your email address are anonymised.</li>
          <li>Your newsletter subscription, if any, is removed.</li>
          <li>
            A record that the deletion happened is kept in our audit log, as the law requires us to
            be able to show it.
          </li>
        </ul>
        {isAdmin ? (
          <p className="text-[0.875rem] leading-[1.7] text-ink">
            <strong>You are an administrator.</strong> If no one else holds that role, make
            someone an admin first — nobody will be able to manage accounts after you leave.
          </p>
        ) : null}
        <p className="text-[0.875rem] text-ink">This cannot be undone.</p>

        {confirming ? (
          <form
            className="flex w-full max-w-md flex-col gap-4"
            onSubmit={(event) => {
              void erase(event);
            }}
          >
            <div className={field}>
              <label className={fieldLabel} htmlFor="delete-confirm">
                Type your email address to confirm
              </label>
              <input
                id="delete-confirm"
                className={input}
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btnSmallDanger} type="submit" disabled={!matches || busy}>
                {busy ? 'Deleting…' : 'Delete my account'}
              </button>
              <button
                className={btnSmall}
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  setTyped('');
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className={btnSmallDanger} type="button" onClick={() => setConfirming(true)}>
            Delete my account…
          </button>
        )}

        {error ? (
          <p className="text-[0.875rem] text-msg-bad" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
