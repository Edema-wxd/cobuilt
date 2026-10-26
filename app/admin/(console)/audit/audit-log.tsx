'use client';

import { useState } from 'react';
import {
  PageHeader,
  Pager,
  StateBox,
  btnSmall,
  filterInput,
  formatDateTime,
  muted,
  panel,
  td,
  th,
  useResource,
  withQuery,
  type Page,
} from '../../kit';

/** The audit trail — `GET /api/admin/audit-log`, shaped as that route maps each row. */

interface AuditEntry {
  id: string;
  actor: { id: string | null; email: string | null };
  action: string;
  entity: { type: string | null; id: string | null };
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLog() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [applied, setApplied] = useState({ action: '', entityType: '' });
  const [page, setPage] = useState(1);

  const list = useResource<Page<AuditEntry>>(
    withQuery('/api/admin/audit-log', { ...applied, page, pageSize: 50 }),
  );

  return (
    <>
      <PageHeader label="Audit log" title="Who did what">
        Every sign-in, role change, approval, moderation and submission view, newest first.
      </PageHeader>

      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ action: action.trim(), entityType: entityType.trim() });
          setPage(1);
        }}
      >
        <label className="flex flex-col gap-1 text-[0.75rem] text-zinc-700">
          Action
          <input
            className={filterInput}
            placeholder="e.g. user.role_changed"
            value={action}
            maxLength={100}
            onChange={(event) => setAction(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.75rem] text-zinc-700">
          Entity type
          <input
            className={filterInput}
            placeholder="e.g. project"
            value={entityType}
            maxLength={100}
            onChange={(event) => setEntityType(event.target.value)}
          />
        </label>
        <button className={btnSmall} type="submit">
          Filter
        </button>
      </form>

      <section className={panel} aria-busy={list.loading}>
        {!list.data || list.data.results.length === 0 ? (
          <StateBox loading={list.loading} error={list.error} onRetry={list.reload} empty="No entries match." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-2xl border-collapse">
                <thead>
                  <tr>
                    <th className={th} scope="col">When</th>
                    <th className={th} scope="col">Who</th>
                    <th className={th} scope="col">Action</th>
                    <th className={th} scope="col">On</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.results.map((entry) => (
                    <tr key={entry.id}>
                      <td className={`${td} whitespace-nowrap`}>{formatDateTime(entry.createdAt)}</td>
                      <td className={td}>
                        <span className="break-all">{entry.actor.email ?? 'System'}</span>
                        {entry.ipAddress ? <span className={`block ${muted}`}>{entry.ipAddress}</span> : null}
                      </td>
                      <td className={td}>
                        <code className="font-mono text-[0.8125rem] text-ink">{entry.action}</code>
                        {hasChanges(entry.changes) ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[0.75rem] text-rust hover:text-rust-hover">
                              Details
                            </summary>
                            <pre className="mt-1.5 max-w-md overflow-x-auto bg-zinc-100 p-2.5 font-mono text-[0.75rem] text-zinc-700">
                              {JSON.stringify(entry.changes, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </td>
                      <td className={td}>
                        {entry.entity.type ?? '—'}
                        {entry.entity.id ? (
                          <span className={`block font-mono text-[0.75rem] ${muted}`} title={entry.entity.id}>
                            {entry.entity.id.slice(0, 8)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
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

function hasChanges(changes: unknown): boolean {
  return changes !== null && typeof changes === 'object' && Object.keys(changes).length > 0;
}
