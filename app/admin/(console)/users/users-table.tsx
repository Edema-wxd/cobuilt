'use client';

import { useState } from 'react';
import { ROLES, type Role } from '@/lib/auth/rbac';
import { ApiFailure, api, type AdminUser } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  PageHeader,
  Pager,
  StateBox,
  btnSmallOrange,
  filterSelect,
  formatDateTime,
  muted,
  panel,
  td,
  th,
  useResource,
  withQuery,
  type Page,
} from '../../kit';

/**
 * Accounts and roles — `GET /api/admin/users` and
 * `POST /api/admin/users/[userId]/role`.
 *
 * Per-user permission grants and revocations exist in the API but are not
 * offered here; roles are the model the brief describes, and a grant edited
 * from a table row is too easy to get wrong unseen.
 */

const ROLE_NOTES: Record<Role, string> = {
  admin: 'Everything, including users and legal sign-off',
  editor: 'Projects, news, tours; reads submissions',
  viewer: 'Read-only dashboard and analytics',
  investor: 'Phase 2 — no console access',
};

export default function UsersTable() {
  const { user: me, can } = useSession();
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const list = useResource<Page<AdminUser>>(
    withQuery('/api/admin/users', { role, page, pageSize: 25 }),
  );
  const canEdit = can('users:write');

  return (
    <>
      <PageHeader label="Users" title="Accounts and roles">
        {canEdit
          ? 'Changing a role signs that person out of every device. The new role is in force within 15 minutes, once their current access token expires.'
          : 'Your role can see accounts but not change them.'}
      </PageHeader>

      <div className="mb-5">
        <label className="sr-only" htmlFor="users-role">
          Role
        </label>
        <select
          id="users-role"
          className={filterSelect}
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r[0]!.toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <section className={panel} aria-busy={list.loading}>
        {!list.data || list.data.results.length === 0 ? (
          <StateBox loading={list.loading} error={list.error} onRetry={list.reload} empty="No accounts match." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-2xl border-collapse">
                <thead>
                  <tr>
                    <th className={th} scope="col">Account</th>
                    <th className={th} scope="col">Role</th>
                    <th className={th} scope="col">Status</th>
                    <th className={th} scope="col">Last sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.results.map((account) => (
                    <UserRow
                      key={account.id}
                      account={account}
                      editable={canEdit && account.id !== me.id}
                      isSelf={account.id === me.id}
                      onSaved={(updated) =>
                        list.setData((current) => ({
                          ...current,
                          results: current.results.map((r) => (r.id === updated.id ? updated : r)),
                        }))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pager pagination={list.data.pagination} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}

function UserRow({
  account,
  editable,
  isSelf,
  onSaved,
}: {
  account: AdminUser;
  editable: boolean;
  isSelf: boolean;
  onSaved: (updated: AdminUser) => void;
}) {
  const [role, setRole] = useState<Role>(account.role);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const changed = role !== account.role;

  async function save(): Promise<void> {
    const confirmed = window.confirm(
      `Change ${account.fullName} from ${account.role} to ${role}? They will be signed out of every device.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    try {
      const updated = await api<AdminUser>(`/api/admin/users/${account.id}/role`, {
        method: 'POST',
        json: { role },
      });
      onSaved(updated);
      setMessage({ text: 'Saved.', bad: false });
    } catch (failure) {
      setRole(account.role);
      setMessage({
        text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.',
        bad: true,
      });
    } finally {
      setSaving(false);
    }
  }

  const selectId = `role-${account.id}`;

  return (
    <tr>
      <td className={td}>
        <span className="font-semibold text-ink">{account.fullName}</span>
        {isSelf ? <span className={`ml-1.5 ${muted}`}>(you)</span> : null}
        <span className={`block break-all ${muted}`}>{account.email}</span>
      </td>
      <td className={td}>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={selectId}>
              Role for {account.fullName}
            </label>
            <select
              id={selectId}
              className={filterSelect}
              value={role}
              disabled={saving}
              onChange={(event) => {
                setRole(event.target.value as Role);
                setMessage(null);
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {changed ? (
              <button className={btnSmallOrange} type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            ) : null}
          </div>
        ) : (
          <span className="capitalize">{account.role}</span>
        )}
        <span className={`mt-1 block text-[0.75rem] ${message?.bad ? 'text-msg-bad' : 'text-zinc-600'}`} role="status">
          {message ? message.text : ROLE_NOTES[role]}
        </span>
      </td>
      <td className={td}>
        <span className={account.isActive ? 'text-msg-ok' : 'text-msg-bad'}>
          {account.isActive ? 'Active' : 'Deactivated'}
        </span>
        <span className={`block ${muted}`}>
          {account.twoFactorEnabled ? '2FA on' : '2FA off'} · {account.emailVerified ? 'verified' : 'unverified'}
        </span>
      </td>
      <td className={`${td} whitespace-nowrap`}>{formatDateTime(account.lastLogin)}</td>
    </tr>
  );
}
