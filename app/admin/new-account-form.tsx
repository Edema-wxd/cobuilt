'use client';

import { useState } from 'react';
import { ROLES, type Role } from '@/lib/auth/rbac';
import { field, fieldLabel, input } from '../../components/sections';
import { ApiFailure, inviteAccount, type AdminUser } from './auth-client';
import { errorText, hint, submitButton } from './auth-frame';
import { ROLE_NOTES } from './kit';

/**
 * `POST /api/auth/register`, shaped to `registerBody`: an administrator invites
 * someone by email. No password is set here — the person chooses their own when
 * they sign up at /admin/register with this address.
 */
export default function NewAccountForm({
  defaultRole,
  submitLabel,
  onCreated,
}: {
  defaultRole: Role;
  submitLabel: string;
  onCreated: (user: AdminUser) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(defaultRole);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setMessage('');

    try {
      const user = await inviteAccount({ fullName, email, role });
      onCreated(user);
    } catch (failure) {
      setSending(false);
      setMessage(
        failure instanceof ApiFailure
          ? failure.message
          : 'No connection to the server. Check your network and try again.',
      );
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <div className={field}>
        <label className={fieldLabel} htmlFor="account-name">
          Full name
        </label>
        <input
          id="account-name"
          className={input}
          type="text"
          autoComplete="off"
          required
          minLength={2}
          maxLength={255}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="account-email">
          Email address
        </label>
        <input
          id="account-email"
          className={input}
          type="email"
          autoComplete="off"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className={field}>
        <label className={fieldLabel} htmlFor="account-role">
          Role
        </label>
        <select
          id="account-role"
          className={`${input} select-chevron cursor-pointer pr-10`}
          value={role}
          aria-describedby="account-role-hint"
          onChange={(event) => setRole(event.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r[0]!.toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <p id="account-role-hint" className={hint}>
          {ROLE_NOTES[role]}
        </p>
      </div>

      <button className={submitButton} type="submit" disabled={sending}>
        {sending ? 'Inviting…' : submitLabel}
      </button>

      {message ? (
        <p className={errorText} role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
