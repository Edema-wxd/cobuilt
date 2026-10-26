'use client';

import { useState } from 'react';
import type { serializeSubmission, serializeSubmissionSummary } from '@/lib/serializers';
import { ApiFailure, api } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  Fact,
  PageHeader,
  Pager,
  StateBox,
  btnSmall,
  btnSmallDanger,
  filterSelect,
  formatDateTime,
  muted,
  panel,
  panelHead,
  panelTitle,
  td,
  th,
  useResource,
  withQuery,
  type Page,
} from '../../kit';

/**
 * The form submissions inbox — `GET /api/admin/forms` and its detail route.
 *
 * The list arrives with contact details masked (docs/decisions.md §2.8).
 * Opening a submission reveals them and is itself written to the audit log,
 * so a submission is only fetched when someone chooses to open it.
 */

type Summary = ReturnType<typeof serializeSubmissionSummary>;
type Detail = ReturnType<typeof serializeSubmission>;

type View = 'inbox' | 'spam' | 'all';
const VIEW_FILTER: Record<View, string | undefined> = { inbox: 'false', spam: 'true', all: undefined };

const FORM_TYPES = [
  { value: '', label: 'All forms' },
  { value: 'inquiry', label: 'Enquiries' },
  { value: 'investment', label: 'Investment interest' },
  { value: 'newsletter', label: 'Newsletter' },
] as const;

const FORM_LABELS: Record<string, string> = {
  inquiry: 'Enquiry',
  investment: 'Investment',
  newsletter: 'Newsletter',
};

export default function SubmissionsInbox() {
  const { user, can } = useSession();
  const [view, setView] = useState<View>('inbox');
  const [formType, setFormType] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useResource<Page<Summary>>(
    withQuery('/api/admin/forms', {
      flaggedAsSpam: VIEW_FILTER[view],
      formType,
      page,
      pageSize: 25,
    }),
  );

  // The detail route admits admins and editors only, though viewers hold
  // forms:read; mirroring its role list keeps a viewer from a guaranteed 403.
  const canOpen = user.role === 'admin' || user.role === 'editor';

  function changeFilter(update: () => void): void {
    update();
    setPage(1);
    setOpenId(null);
  }

  return (
    <>
      <PageHeader label="Submissions" title="Form inbox">
        Contact details are masked in this list.{' '}
        {canOpen
          ? 'Opening a submission shows them in full, and each opening is recorded in the audit log.'
          : 'Your role can see the list but not open individual submissions.'}
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex border border-zinc-400 bg-white" role="group" aria-label="Show">
          {(['inbox', 'spam', 'all'] as const).map((option) => (
            <button
              key={option}
              className={`min-h-target cursor-pointer px-4 text-[0.813rem] capitalize ${
                view === option ? 'bg-ink text-white' : 'text-zinc-700 hover:bg-zinc-100'
              }`}
              type="button"
              aria-pressed={view === option}
              onClick={() => changeFilter(() => setView(option))}
            >
              {option === 'inbox' ? 'Inbox' : option === 'spam' ? 'Spam' : 'All'}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="submissions-type">
          Form
        </label>
        <select
          id="submissions-type"
          className={filterSelect}
          value={formType}
          onChange={(event) => changeFilter(() => setFormType(event.target.value))}
        >
          {FORM_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section className={panel} aria-busy={list.loading}>
          {!list.data || list.data.results.length === 0 ? (
            <StateBox
              loading={list.loading}
              error={list.error}
              onRetry={list.reload}
              empty={view === 'spam' ? 'Nothing is flagged as spam.' : 'No submissions here yet.'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-xl border-collapse">
                  <thead>
                    <tr>
                      <th className={th} scope="col">From</th>
                      <th className={th} scope="col">Message</th>
                      <th className={th} scope="col">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.results.map((row) => (
                      <tr key={row.id} className={openId === row.id ? 'bg-zinc-50' : undefined}>
                        <td className={td}>
                          {canOpen ? (
                            <button
                              className="cursor-pointer text-left font-semibold text-ink underline decoration-zinc-300 underline-offset-4 hover:decoration-ink"
                              type="button"
                              onClick={() => setOpenId(row.id)}
                              aria-expanded={openId === row.id}
                            >
                              {row.name ?? 'No name'}
                            </button>
                          ) : (
                            <span className="font-semibold text-ink">{row.name ?? 'No name'}</span>
                          )}
                          <span className={`block ${muted}`}>{row.email ?? '—'}</span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            <Tag>{FORM_LABELS[row.formType] ?? row.formType}</Tag>
                            {row.flaggedAsSpam ? <Tag tone="bad">Spam</Tag> : null}
                            {row.anonymised ? <Tag>Anonymised</Tag> : null}
                          </span>
                        </td>
                        <td className={`${td} max-w-md`}>{row.excerpt ?? <span className={muted}>No message</span>}</td>
                        <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager pagination={list.data.pagination} onPage={setPage} />
            </>
          )}
        </section>

        {openId ? (
          <SubmissionDetail
            key={openId}
            id={openId}
            canModerate={can('forms:moderate')}
            onClose={() => setOpenId(null)}
            onFlagged={(updated) => {
              // A row flagged from the inbox no longer belongs in it, nor an
              // unflagged one in spam; reloading lets the filter decide.
              list.setData((current) => ({
                ...current,
                results: current.results.map((r) => (r.id === updated.id ? updated : r)),
              }));
              if (view !== 'all') list.reload();
            }}
          />
        ) : null}
      </div>
    </>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'bad' }) {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-[0.1em] uppercase ${
        tone === 'bad' ? 'border-msg-bad text-msg-bad' : 'border-zinc-300 text-zinc-600'
      }`}
    >
      {children}
    </span>
  );
}

function SubmissionDetail({
  id,
  canModerate,
  onClose,
  onFlagged,
}: {
  id: string;
  canModerate: boolean;
  onClose: () => void;
  onFlagged: (updated: Summary) => void;
}) {
  const detail = useResource<Detail>(`/api/admin/forms/${id}`);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function toggleSpam(flagged: boolean): Promise<void> {
    setSaving(true);
    setMessage('');
    try {
      const updated = await api<Summary>(`/api/admin/forms/${id}/flag-spam`, {
        method: 'POST',
        json: { flagged },
      });
      detail.setData((current) => ({ ...current, flaggedAsSpam: updated.flaggedAsSpam }));
      onFlagged(updated);
      setMessage(flagged ? 'Marked as spam.' : 'Moved back to the inbox.');
    } catch (failure) {
      setMessage(failure instanceof ApiFailure ? failure.message : 'No connection to the server.');
    } finally {
      setSaving(false);
    }
  }

  const data = detail.data;

  return (
    <aside className={`${panel} xl:sticky xl:top-8`} aria-label="Submission">
      <div className={panelHead}>
        <h2 className={panelTitle}>Submission</h2>
        <button className={btnSmall} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {!data ? (
        <StateBox loading={detail.loading} error={detail.error} onRetry={detail.reload} />
      ) : (
        <div className="flex flex-col gap-5 px-5 py-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fact label="Name">{data.name ?? '—'}</Fact>
            <Fact label="Form">{FORM_LABELS[data.formType] ?? data.formType}</Fact>
            <Fact label="Email">
              {data.email ? (
                <a className="text-rust underline hover:text-rust-hover" href={`mailto:${data.email}`}>
                  {data.email}
                </a>
              ) : (
                '—'
              )}
            </Fact>
            <Fact label="Phone">
              {data.phone ? (
                <a className="text-rust underline hover:text-rust-hover" href={`tel:${data.phone}`}>
                  {data.phone}
                </a>
              ) : (
                '—'
              )}
            </Fact>
            <Fact label="Received">{formatDateTime(data.submittedAt)}</Fact>
            <Fact label="Spam score">{data.spamScore ?? '—'}</Fact>
          </dl>

          <div>
            <p className="text-[0.688rem] font-semibold tracking-[0.12em] text-zinc-600 uppercase">Message</p>
            <p className="mt-1.5 text-[0.906rem] leading-[1.7] whitespace-pre-wrap text-ink">
              {data.message ?? 'No message.'}
            </p>
          </div>

          <p className={muted}>
            Kept until {formatDateTime(data.retainUntil)}, then anonymised under the retention policy.
          </p>

          {canModerate ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {data.flaggedAsSpam ? (
                <button className={btnSmall} type="button" disabled={saving} onClick={() => void toggleSpam(false)}>
                  Not spam
                </button>
              ) : (
                <button className={btnSmallDanger} type="button" disabled={saving} onClick={() => void toggleSpam(true)}>
                  Mark as spam
                </button>
              )}
              {message ? (
                <p className="text-[0.781rem] text-zinc-700" role="status">
                  {message}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
