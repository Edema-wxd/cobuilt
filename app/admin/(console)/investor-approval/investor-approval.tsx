'use client';

import { useState } from 'react';
import type { serializeProjectForAdmin } from '@/lib/serializers';
import { ApiFailure, api } from '../../auth-client';
import {
  PageHeader,
  Pager,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
  filterInput,
  formatDateTime,
  formatNumber,
  muted,
  panel,
  td,
  th,
  useResource,
  withQuery,
  type Page,
} from '../../kit';

/**
 * Investor-content approval — the legal sign-off gate (docs/decisions.md,
 * serializers.ts). Until a project is approved the public API omits its
 * investment amount, expected ROI and highlights; editing any of them clears
 * the approval again.
 *
 * Reads `GET /api/projects?includeUnpublished=true`, which returns the admin
 * view, drafts included, to an admin or editor bearer token.
 */

type AdminProject = ReturnType<typeof serializeProjectForAdmin>;

export default function InvestorApproval() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useResource<Page<AdminProject>>(
    withQuery('/api/projects', { includeUnpublished: 'true', q, page, pageSize: 25 }),
  );

  return (
    <>
      <PageHeader label="Projects" title="Investor content approval">
        Investment figures stay off the public site until approved here. Approval is recorded in the
        audit log with your note, and any later edit to the figures withdraws it.
      </PageHeader>

      <form
        className="mb-5 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(search.trim());
          setPage(1);
        }}
      >
        <label className="sr-only" htmlFor="projects-search">
          Search projects
        </label>
        <input
          id="projects-search"
          className={filterInput}
          type="search"
          placeholder="Search projects"
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className={btnSmall} type="submit">
          Search
        </button>
      </form>

      <section className={panel} aria-busy={list.loading}>
        {!list.data || list.data.results.length === 0 ? (
          <StateBox loading={list.loading} error={list.error} onRetry={list.reload} empty="No projects match." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-2xl border-collapse">
                <thead>
                  <tr>
                    <th className={th} scope="col">Project</th>
                    <th className={th} scope="col">Investor figures</th>
                    <th className={th} scope="col">Sign-off</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.results.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
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

function ProjectRow({
  project,
  onSaved,
}: {
  project: AdminProject;
  onSaved: (updated: AdminProject) => void;
}) {
  const [deciding, setDeciding] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { investor } = project;
  const hasFigures =
    investor.investmentAmount !== null || investor.expectedRoi !== null || investor.highlights !== null;

  async function decide(approved: boolean): Promise<void> {
    setSaving(true);
    setError('');
    try {
      const updated = await api<AdminProject>(`/api/admin/projects/${project.id}/investor-approval`, {
        method: 'POST',
        json: { approved, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      onSaved(updated);
      setDeciding(false);
      setNote('');
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'No connection to the server.');
    } finally {
      setSaving(false);
    }
  }

  const noteId = `note-${project.id}`;

  return (
    <tr>
      <td className={td}>
        <span className="font-semibold text-ink">{project.title}</span>
        <span className={`block ${muted}`}>
          <span className="capitalize">{project.status}</span> ·{' '}
          {project.isPublished ? 'Published' : project.publishedAt ? `Scheduled ${formatDateTime(project.publishedAt)}` : 'Draft'}
        </span>
      </td>
      <td className={td}>
        {hasFigures ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.813rem]">
            <dt className="text-zinc-600">Amount</dt>
            <dd className="tabular-nums">{formatNumber(investor.investmentAmount)}</dd>
            <dt className="text-zinc-600">Expected ROI</dt>
            <dd className="tabular-nums">{investor.expectedRoi === null ? '—' : `${investor.expectedRoi}%`}</dd>
            <dt className="text-zinc-600">Highlights</dt>
            <dd>{investor.highlights === null ? '—' : 'Provided'}</dd>
          </dl>
        ) : (
          <span className={muted}>None entered</span>
        )}
      </td>
      <td className={`${td} min-w-56`}>
        <p className={investor.approved ? 'font-semibold text-msg-ok' : 'text-zinc-700'}>
          {investor.approved ? 'Approved — shown publicly' : 'Not approved — withheld'}
        </p>

        {deciding ? (
          <div className="mt-2.5 flex flex-col gap-2">
            <label className="text-[0.75rem] text-zinc-700" htmlFor={noteId}>
              Note for the audit log <span className="text-zinc-500">(optional)</span>
            </label>
            <textarea
              id={noteId}
              className={`${filterInput} min-h-20 py-2`}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {investor.approved ? (
                <button className={btnSmallDanger} type="button" disabled={saving} onClick={() => void decide(false)}>
                  {saving ? 'Saving…' : 'Confirm withdrawal'}
                </button>
              ) : (
                <button className={btnSmallOrange} type="button" disabled={saving} onClick={() => void decide(true)}>
                  {saving ? 'Saving…' : 'Confirm approval'}
                </button>
              )}
              <button
                className={btnSmall}
                type="button"
                disabled={saving}
                onClick={() => {
                  setDeciding(false);
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : investor.approved || hasFigures ? (
          <button className={`${btnSmall} mt-2`} type="button" onClick={() => setDeciding(true)}>
            {investor.approved ? 'Withdraw…' : 'Approve…'}
          </button>
        ) : null}

        {error ? (
          <p className="mt-1.5 text-[0.75rem] text-msg-bad" role="alert">
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
