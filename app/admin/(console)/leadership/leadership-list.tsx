'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { serializeLeaderForAdmin } from '@/lib/serializers';
import { ApiFailure, api } from '../../auth-client';
import { PageHeader, StateBox, btnSmall, btnSmallOrange, formatDateTime, muted, panel, td, th, useResource } from '../../kit';
import { TIER_LABEL } from '../../../leadership/leadership-shared';
import { linkText } from '../projects/project-list';

/**
 * Every leader, drafts included, in the order the public page shows them —
 * `GET /api/admin/leadership`. Publication and the homepage spotlight switch
 * in place (`PATCH`), and the arrows move a leader (`POST .../reorder`, which
 * takes the whole list so a stale screen cannot save a half-order).
 */

export type AdminLeader = ReturnType<typeof serializeLeaderForAdmin>;

/** A small toggle that names its state rather than leaving it to colour. */
const toggle =
  'inline-flex min-h-target cursor-pointer items-center gap-2 border border-zinc-300 bg-white px-3 text-[0.813rem] text-ink enabled:hover:border-ink disabled:cursor-not-allowed disabled:opacity-60';

export default function LeadershipList() {
  const list = useResource<{ results: AdminLeader[] }>('/api/admin/leadership');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  async function run(action: () => Promise<void>, done: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: done, bad: false });
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      // A 409 means the list moved under us; reloading shows the current one.
      if (failure instanceof ApiFailure && failure.status === 409) list.reload();
    } finally {
      setBusy(false);
    }
  }

  function patch(leader: AdminLeader, changes: { published?: boolean; featured?: boolean }, done: string) {
    void run(async () => {
      const saved = await api<AdminLeader>(`/api/admin/leadership/${leader.id}`, { method: 'PATCH', json: changes });
      list.setData((current) => ({
        results: current.results.map((row) => (row.id === saved.id ? saved : row)),
      }));
    }, done);
  }

  function move(index: number, by: -1 | 1) {
    const rows = list.data?.results ?? [];
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((row) => row.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];

    void run(async () => {
      const saved = await api<{ results: AdminLeader[] }>('/api/admin/leadership/reorder', {
        method: 'POST',
        json: { ids },
      });
      list.setData(() => saved);
    }, `${rows[index]!.fullName} moved ${by < 0 ? 'up' : 'down'}.`);
  }

  const rows = list.data?.results ?? [];

  return (
    <>
      <PageHeader label="Leadership" title="Leadership profiles">
        Published profiles appear on the leadership page in this order, within a minute of saving.
        Spotlight puts a published leader on the homepage too.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className={muted}>
          <a className={linkText} href="/leadership" target="_blank" rel="noopener noreferrer">
            View the leadership page
          </a>
        </p>
        <Link className={btnSmallOrange} href="/admin/leadership/new">
          New profile
        </Link>
      </div>

      {message ? (
        <p
          className={`mb-4 text-[0.813rem] ${message.bad ? 'text-msg-bad' : 'text-msg-ok'}`}
          role={message.bad ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}

      <section className={panel} aria-busy={list.loading || busy}>
        {rows.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="There are no leadership profiles yet. Until one is published, the leadership page shows its “profiles pending” state."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse">
              <thead>
                <tr>
                  <th className={th} scope="col">Order</th>
                  <th className={th} scope="col">Leader</th>
                  <th className={th} scope="col">Structure</th>
                  <th className={th} scope="col">Public page</th>
                  <th className={th} scope="col">Homepage</th>
                  <th className={th} scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((leader, index) => (
                  <tr key={leader.id}>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 font-mono text-[0.813rem] text-zinc-600">{index + 1}</span>
                        <button
                          className={`${btnSmall} px-3`}
                          type="button"
                          disabled={busy || index === 0}
                          onClick={() => move(index, -1)}
                          aria-label={`Move ${leader.fullName} up`}
                        >
                          ↑
                        </button>
                        <button
                          className={`${btnSmall} px-3`}
                          type="button"
                          disabled={busy || index === rows.length - 1}
                          onClick={() => move(index, 1)}
                          aria-label={`Move ${leader.fullName} down`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className={`${td} max-w-xs`}>
                      <Link className="font-semibold text-ink hover:text-rust" href={`/admin/leadership/${leader.id}`}>
                        {leader.fullName}
                      </Link>
                      <span className={`block ${muted}`}>
                        {leader.roleTitle ?? 'No role'}
                        {leader.cms ? ' · From the CMS' : ''}
                      </span>
                    </td>
                    <td className={td}>{TIER_LABEL[leader.tier]}</td>
                    <td className={td}>
                      <button
                        className={toggle}
                        type="button"
                        disabled={busy}
                        aria-pressed={leader.published}
                        onClick={() =>
                          patch(
                            leader,
                            { published: !leader.published },
                            leader.published
                              ? `${leader.fullName} is now a draft.`
                              : `${leader.fullName} is published.`,
                          )
                        }
                      >
                        <span className={leader.published ? 'text-msg-ok' : 'text-zinc-700'}>
                          {leader.published ? 'Published' : 'Draft'}
                        </span>
                        <span className="text-[0.688rem] tracking-[0.12em] text-zinc-500 uppercase">
                          {leader.published ? 'Unpublish' : 'Publish'}
                        </span>
                      </button>
                    </td>
                    <td className={td}>
                      <button
                        className={toggle}
                        type="button"
                        disabled={busy}
                        aria-pressed={leader.featured}
                        onClick={() =>
                          patch(
                            leader,
                            { featured: !leader.featured },
                            leader.featured
                              ? `${leader.fullName} left the homepage spotlight.`
                              : `${leader.fullName} is in the homepage spotlight.`,
                          )
                        }
                      >
                        <span className={leader.featured ? 'text-msg-ok' : 'text-zinc-700'}>
                          {leader.featured ? 'Spotlight' : 'Not shown'}
                        </span>
                        <span className="text-[0.688rem] tracking-[0.12em] text-zinc-500 uppercase">
                          {leader.featured ? 'Remove' : 'Add'}
                        </span>
                      </button>
                      {leader.featured && !leader.published ? (
                        <span className={`block ${muted}`}>Shown once published</span>
                      ) : null}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(leader.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
