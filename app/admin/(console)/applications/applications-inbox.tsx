'use client';

import { useEffect, useState } from 'react';
import type { ApplicationDetail, ApplicationSummary } from '@/lib/repositories/jobApplications';
import type { AdminVacancy } from '@/lib/repositories/vacancies';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from '@/lib/careers';
import { fileFacts } from '../../../../components/documents';
import { ApiFailure, api, authHeaders } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  Fact,
  PageHeader,
  Pager,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
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
import { fieldLabel, selectInput, textarea } from '../../form-kit';

/**
 * The job applications inbox — `GET /api/admin/careers/applications` and its
 * detail routes, behind `applications:read` (admin only by default).
 *
 * As in the form inbox, the list arrives with contact details masked
 * (docs/decisions.md §2.8); opening an application shows them and is written
 * to the audit log, so one is only fetched when someone chooses to open it.
 * The CV downloads through the console, with the session's bearer token: it
 * is at no public address (§2.28). `?vacancy=` and `?open=` — the links from
 * the vacancies list and the staff email — preselect a filter or an
 * application.
 */

type View = 'inbox' | 'spam' | 'all';
const VIEW_FILTER: Record<View, string | undefined> = { inbox: 'false', spam: 'true', all: undefined };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function typeLabel(contentType: string): string {
  return contentType === 'application/pdf' ? 'pdf' : 'docx';
}

export default function ApplicationsInbox() {
  const { can } = useSession();
  const [view, setView] = useState<View>('inbox');
  const [vacancy, setVacancy] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  // The URL's filters are read once, before the first list request.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('vacancy');
    if (fromUrl && (fromUrl === 'speculative' || UUID.test(fromUrl))) setVacancy(fromUrl);
    const open = params.get('open');
    if (open && UUID.test(open)) {
      setOpenId(open);
      // An application from the staff email may already be past "new", or flagged.
      setView('all');
    }
    setReady(true);
  }, []);

  const list = useResource<Page<ApplicationSummary>>(
    ready
      ? withQuery('/api/admin/careers/applications', {
          flaggedAsSpam: VIEW_FILTER[view],
          vacancy,
          status,
          page,
          pageSize: 25,
        })
      : null,
  );
  // The vacancy names for the filter. Listing vacancies is careers:write; without
  // it the filter offers only the speculative choice and whatever is on screen.
  const vacancies = useResource<{ results: AdminVacancy[] }>(
    can('careers:write') ? '/api/admin/careers/vacancies' : null,
  );
  const vacancyOptions = vacancies.data
    ? vacancies.data.results.map((item) => ({ id: item.id, title: item.title }))
    : [
        ...new Map(
          (list.data?.results ?? []).flatMap((row) => (row.vacancy ? [[row.vacancy.id, row.vacancy.title]] : [])),
        ),
      ].map(([id, title]) => ({ id, title }));

  function changeFilter(update: () => void): void {
    update();
    setPage(1);
    setOpenId(null);
  }

  return (
    <>
      <PageHeader label="Careers" title="Applications">
        Applications and CVs sent through the Careers page. Contact details are masked in this list; opening an
        application shows them in full, and each opening and each CV download is recorded in the audit log.
        Applications are deleted, CVs with them, six months after they arrive.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex border border-zinc-400 bg-white" role="group" aria-label="Show">
          {(['inbox', 'spam', 'all'] as const).map((option) => (
            <button
              key={option}
              className={`min-h-target cursor-pointer px-4 text-[0.813rem] ${
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
        <label className="sr-only" htmlFor="applications-vacancy">
          Vacancy
        </label>
        <select
          id="applications-vacancy"
          className={`${filterSelect} max-w-full`}
          value={vacancy}
          onChange={(event) => changeFilter(() => setVacancy(event.target.value))}
        >
          <option value="">Every vacancy</option>
          <option value="speculative">Speculative applications</option>
          {vacancyOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
          {vacancy && vacancy !== 'speculative' && !vacancyOptions.some((option) => option.id === vacancy) ? (
            <option value={vacancy}>The chosen vacancy</option>
          ) : null}
        </select>
        <label className="sr-only" htmlFor="applications-status">
          Status
        </label>
        <select
          id="applications-status"
          className={filterSelect}
          value={status}
          onChange={(event) => changeFilter(() => setStatus(event.target.value as ApplicationStatus | ''))}
        >
          <option value="">Every status</option>
          {APPLICATION_STATUSES.map((option) => (
            <option key={option} value={option}>
              {APPLICATION_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <section className={panel} aria-busy={list.loading} aria-label="Applications">
          {!list.data || list.data.results.length === 0 ? (
            <StateBox
              loading={list.loading || !ready}
              error={list.error}
              onRetry={list.reload}
              empty={view === 'spam' ? 'Nothing is flagged as spam.' : 'No applications here.'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-xl border-collapse">
                  <thead>
                    <tr>
                      <th className={th} scope="col">Applicant</th>
                      <th className={th} scope="col">Role</th>
                      <th className={th} scope="col">Status</th>
                      <th className={th} scope="col">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.results.map((row) => (
                      <tr key={row.id} className={openId === row.id ? 'bg-zinc-50' : undefined}>
                        <td className={td}>
                          <button
                            className="min-h-target cursor-pointer text-left font-semibold break-words text-ink underline decoration-zinc-300 underline-offset-4 hover:decoration-ink"
                            type="button"
                            onClick={() => setOpenId(row.id)}
                            aria-expanded={openId === row.id}
                          >
                            {row.name}
                          </button>
                          <span className={`block ${muted}`}>{row.email ?? '—'}</span>
                          <span className={`block ${muted}`}>CV: {fileFacts(typeLabel(row.cv.contentType), row.cv.sizeBytes)}</span>
                        </td>
                        <td className={`${td} max-w-xs break-words`}>
                          {row.vacancy ? row.vacancy.title : <span className={muted}>Speculative</span>}
                        </td>
                        <td className={td}>
                          <span className="flex flex-wrap gap-1.5">
                            <Tag>{APPLICATION_STATUS_LABELS[row.status]}</Tag>
                            {row.flaggedAsSpam ? <Tag tone="bad">Spam</Tag> : null}
                          </span>
                        </td>
                        <td className={`${td} whitespace-nowrap`}>{formatDateTime(row.createdAt)}</td>
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
          <ApplicationPanel
            key={openId}
            id={openId}
            onClose={() => setOpenId(null)}
            onChanged={(updated) => {
              list.setData((current) => ({
                ...current,
                results: current.results.map((row) =>
                  row.id === updated.id
                    ? { ...row, status: updated.status, flaggedAsSpam: updated.flaggedAsSpam }
                    : row,
                ),
              }));
            }}
            onDeleted={() => {
              setOpenId(null);
              list.reload();
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

/**
 * Fetches the CV with the session's token and hands it to the browser as a
 * download. There is no link to the file to open in a tab: it exists only
 * behind this authenticated request.
 */
async function downloadCv(id: string, fallbackName: string): Promise<void> {
  const response = await fetch(`/api/admin/careers/applications/${id}/cv`, {
    headers: await authHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiFailure(
      response.status,
      response.status === 401
        ? 'Your session has ended. Sign in again.'
        : (payload?.error?.message ?? 'The CV could not be downloaded.'),
    );
  }

  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : fallbackName;

  const url = URL.createObjectURL(await response.blob());
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Long enough for the browser to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function ApplicationPanel({
  id,
  onClose,
  onChanged,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onChanged: (updated: ApplicationDetail) => void;
  onDeleted: () => void;
}) {
  const { user } = useSession();
  const detail = useResource<ApplicationDetail>(`/api/admin/careers/applications/${id}`);
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const data = detail.data;
  const currentStatus = status ?? data?.status ?? 'new';
  const currentNotes = notes ?? data?.staffNotes ?? '';
  const dirty = Boolean(data) && (currentStatus !== data!.status || currentNotes.trim() !== (data!.staffNotes ?? ''));

  function fail(failure: unknown): void {
    setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
  }

  async function patch(json: Record<string, unknown>, done: string): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await api<ApplicationDetail>(`/api/admin/careers/applications/${id}`, { method: 'PATCH', json });
      detail.setData(() => updated);
      setStatus(null);
      setNotes(null);
      onChanged(updated);
      setMessage({ text: done, bad: false });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!data) return;
    const json: Record<string, unknown> = {};
    if (currentStatus !== data.status) json.status = currentStatus;
    if (currentNotes.trim() !== (data.staffNotes ?? '')) json.staffNotes = currentNotes.trim() || null;
    if (Object.keys(json).length === 0) {
      setMessage({ text: 'Nothing has changed.', bad: false });
      return;
    }
    await patch(json, 'Saved.');
  }

  async function download(): Promise<void> {
    if (!data) return;
    setBusy(true);
    setMessage(null);
    try {
      await downloadCv(id, data.cv.fileName);
      setMessage({ text: `Downloading ${data.cv.fileName}.`, bad: false });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!data) return;
    if (!window.confirm(`Delete the application from ${data.name}, and their CV? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api<void>(`/api/admin/careers/applications/${id}`, { method: 'DELETE' });
      onDeleted();
    } catch (failure) {
      fail(failure);
      setBusy(false);
    }
  }

  return (
    <aside className={`${panel} xl:sticky xl:top-8`} aria-label="Application">
      <div className={panelHead}>
        <h2 className={panelTitle}>Application</h2>
        <button className={btnSmall} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {!data ? (
        <StateBox loading={detail.loading} error={detail.error} onRetry={detail.reload} />
      ) : (
        <div className="flex flex-col gap-5 px-5 py-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fact label="Name">{data.name}</Fact>
            <Fact label="Role">{data.vacancy ? data.vacancy.title : 'Speculative application'}</Fact>
            <Fact label="Email">
              <a className="text-rust underline hover:text-rust-hover" href={`mailto:${data.email}`}>
                {data.email}
              </a>
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
            <Fact label="Received">{formatDateTime(data.createdAt)}</Fact>
            <Fact label="Spam score">{data.spamScore ?? '—'}</Fact>
          </dl>

          <div>
            <p className="text-[0.688rem] font-semibold tracking-[0.12em] text-zinc-600 uppercase">Cover note</p>
            <p className="mt-1.5 text-[0.906rem] leading-[1.7] whitespace-pre-wrap break-words text-ink">
              {data.coverNote ?? 'No cover note.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button className={btnSmallOrange} type="button" disabled={busy} onClick={() => void download()}>
              Download CV<span className="sr-only">: {data.cv.fileName}</span>
            </button>
            <p className={`${muted} min-w-0 break-all`}>
              {data.cv.fileName} · {fileFacts(typeLabel(data.cv.contentType), data.cv.sizeBytes)}
            </p>
          </div>

          <form className="flex flex-col gap-4 border-t border-line pt-4" onSubmit={(event) => void save(event)}>
            <div className="flex flex-col gap-1.75">
              <label className={fieldLabel} htmlFor="application-status">
                Status
              </label>
              <select
                id="application-status"
                className={selectInput}
                value={currentStatus}
                disabled={busy}
                onChange={(event) => setStatus(event.target.value as ApplicationStatus)}
              >
                {APPLICATION_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {APPLICATION_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.75">
              <label className={fieldLabel} htmlFor="application-notes">
                Staff notes
              </label>
              <textarea
                id="application-notes"
                className={`${textarea} min-h-28`}
                maxLength={5000}
                value={currentNotes}
                disabled={busy}
                onChange={(event) => setNotes(event.target.value)}
                aria-describedby="application-notes-hint"
              />
              <p id="application-notes-hint" className={muted}>
                For the hiring team only. The applicant can ask to see what is held about them, notes included,
                so write what you would be content for them to read.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button className={btnSmallOrange} type="submit" disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              {data.flaggedAsSpam ? (
                <button className={btnSmall} type="button" disabled={busy} onClick={() => void patch({ flaggedAsSpam: false }, 'Moved to the inbox.')}>
                  Not spam
                </button>
              ) : (
                <button className={btnSmall} type="button" disabled={busy} onClick={() => void patch({ flaggedAsSpam: true }, 'Marked as spam.')}>
                  Mark as spam
                </button>
              )}
              {user.role === 'admin' ? (
                <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={busy} onClick={() => void remove()}>
                  Delete
                </button>
              ) : null}
            </div>
          </form>

          {message ? (
            <p className={`text-[0.813rem] ${message.bad ? 'text-msg-bad' : 'text-msg-ok'}`} role={message.bad ? 'alert' : 'status'}>
              {message.text}
            </p>
          ) : null}

          <p className={muted}>
            Kept until {formatDateTime(data.retainUntil)}, then deleted with its CV under the retention policy.
          </p>
        </div>
      )}
    </aside>
  );
}
