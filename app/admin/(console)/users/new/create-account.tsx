'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminUser } from '../../../auth-client';
import { useSession } from '../../console-shell';
import { PageHeader, btnSmall, btnSmallOrange, muted, panel } from '../../../kit';
import NewAccountForm from '../../../new-account-form';

/**
 * `POST /api/auth/register` as an admin. The route checks the role itself, not
 * `users:write`, so the screen does too.
 */
export default function CreateAccount() {
  const { user: me } = useSession();
  const [created, setCreated] = useState<AdminUser | null>(null);
  // Remounts the form empty for "create another".
  const [round, setRound] = useState(0);

  if (me.role !== 'admin') {
    return (
      <>
        <PageHeader label="Users" title="New account" />
        <p className={`${panel} p-5 ${muted}`}>Only an administrator can create accounts.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader label="Users" title="Invite someone">
        Phase 1 has no open sign-up; this is how every account is made. Set the email and role
        here, then ask the person to create their password at /admin/register with that same
        address. They confirm it with a code we email them, and the role applies from then on.
      </PageHeader>

      <section className={`${panel} max-w-xl p-5 sm:p-6`}>
        {created ? (
          <div className="flex flex-col gap-4" role="status">
            <p className="text-[0.938rem] text-ink">
              Invited <strong>{created.fullName}</strong> ({created.email}) as{' '}
              {created.role}. They can now sign up at /admin/register.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className={btnSmallOrange}
                type="button"
                onClick={() => {
                  setCreated(null);
                  setRound((n) => n + 1);
                }}
              >
                Invite another
              </button>
              <Link className={btnSmall} href="/admin/users">
                Back to users
              </Link>
            </div>
          </div>
        ) : (
          <NewAccountForm
            key={round}
            defaultRole="viewer"
            submitLabel="Invite"
            onCreated={setCreated}
          />
        )}
      </section>
    </>
  );
}
