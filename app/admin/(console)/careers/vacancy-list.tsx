'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminVacancy } from '@/lib/repositories/vacancies';
import { VACANCY_TYPE_LABELS, formatClosingDate } from '@/lib/careers';
import { ApiFailure, api } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallOrange,
  formatDateTime,
  formatNumber,
  muted,
  panel,
  panelHead,
  panelTitle,
  td,
  th,
  useResource,
} from '../../kit';
import { linkText } from '../projects/project-list';

/**
 * Vacancies — `GET /api/admin/careers/vacancies`, in the order `/careers`
 * shows them within each type. Moving a row sends the whole new order to
 * `POST .../reorder`; publishing or unpublishing is a `PATCH`.
 *
 * Each row carries its application counts. Reading the applications is a
 * separate permission (`applications:read`, admin only by default), so the
 * counts link to the inbox only for those who hold it.
 */

export type { AdminVacancy };

/** Draft, published, or published but past its closing date. */
export function vacancyState(vacancy: Pick<AdminVacancy, 'published' | 'isOpen'>): {
  label: string;
  live: boolean;
} {
  if (!vacancy.published) return { label: 'Draft', live: false };
  return vacancy.isOpen ? { label: 'Published', live: true } : { label: 'Closed', live: false };
}

export default function VacancyList() {
  const { can } = useSession();
  const list = useResource<{ results: AdminVacancy[] }>('/api/admin/careers/vacancies');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const canReadApplications = can('applications:read');

  function fail(failure: unknown): void {
    setMessage({
      text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.',
      bad: true,
    });
  }

  async function move(index: number, by: -1 | 1): Promise<void> {
    const vacancies = list.data?.results;
    if (!vacancies) return;
    const ids = vacancies.map((vacancy) => vacancy.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);

    setBusy(true);
    setMessage(null);
    try {
      const reordered = await api<{ results: AdminVacancy[] }>('/api/admin/careers/vacancies/reorder', {
        method: 'POST',
        json: { ids },
      });
      list.setData(() => reordered);
      setMessage({ text: 'Order saved. The Careers page follows within a minute.', bad: false });
    } catch (failure) {
      fail(failure);
      // A 422 means the list was stale; show the current order.
      list.reload();
    } finally {
      setBusy(false);
    }
  }

  async function setPublished(vacancy: AdminVacancy, published: boolean): Promise<void> {
    if (
      !published &&
      !window.confirm(`Unpublish “${vacancy.title}”? It leaves the Careers page and stops taking applications.`)
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const saved = await api<AdminVacancy>(`/api/admin/careers/vacancies/${vacancy.id}`, {
        method: 'PATCH',
        json: { published },
      });
      list.setData((current) => ({
        results: current.results.map((item) => (item.id === saved.id ? saved : item)),
      }));
      setMessage({
        text: published
          ? saved.isOpen
            ? `“${saved.title}” is published. It appears on the Careers page within a minute.`
            : `“${saved.title}” is published, but its closing date has passed, so it is not listed. Change the closing date to reopen it.`
          : `“${saved.title}” is unpublished.`,
        bad: false,
      });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const vacancies = list.data?.results ?? [];
  const live = vacancies.filter((vacancy) => vacancyState(vacancy).live).length;

  return (
    <>
      <PageHeader label="Careers" title="Vacancies">
        The roles on the Careers page, in the order they are listed within each type. A vacancy leaves the
        page, and stops taking applications, at the end of its closing date (WAT).{' '}
        <a className={linkText} href="/careers" target="_blank" rel="noopener noreferrer">
          View the Careers page<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className={muted} role={message?.bad ? 'alert' : 'status'}>
          {message ? (
            <span className={message.bad ? 'text-msg-bad' : 'text-msg-ok'}>{message.text}</span>
          ) : list.data ? (
            `${live} taking applications, of ${vacancies.length}`
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {canReadApplications ? (
            <Link className={btnSmall} href="/admin/applications">
              Applications inbox
            </Link>
          ) : null}
          <Link className={btnSmallOrange} href="/admin/careers/new">
            Add a vacancy
          </Link>
        </div>
      </div>

      <section className={panel} aria-labelledby="vacancies-title" aria-busy={list.loading || busy}>
        <div className={panelHead}>
          <h2 className={panelTitle} id="vacancies-title">
            Every vacancy
          </h2>
        </div>
        {vacancies.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="There are no vacancies yet. While there are none, the Careers page says so and offers the speculative application form."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse">
              <thead>
                <tr>
                  <th className={th} scope="col">Order</th>
                  <th className={th} scope="col">Vacancy</th>
                  <th className={th} scope="col">Publication</th>
                  <th className={th} scope="col">Closes</th>
                  <th className={th} scope="col">Applications</th>
                  <th className={th} scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((vacancy, index) => {
                  const state = vacancyState(vacancy);
                  return (
                    <tr key={vacancy.id}>
                      <td className={`${td} whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          <span className="w-6 font-mono text-[0.813rem] text-zinc-600">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <button
                            className={`${btnSmall} px-3`}
                            type="button"
                            disabled={busy || index === 0}
                            onClick={() => void move(index, -1)}
                            aria-label={`Move ${vacancy.title} up`}
                          >
                            ↑
                          </button>
                          <button
                            className={`${btnSmall} px-3`}
                            type="button"
                            disabled={busy || index === vacancies.length - 1}
                            onClick={() => void move(index, 1)}
                            aria-label={`Move ${vacancy.title} down`}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td className={`${td} max-w-xs`}>
                        <Link
                          className="font-semibold break-words text-ink hover:text-rust"
                          href={`/admin/careers/${vacancy.id}`}
                        >
                          {vacancy.title}
                        </Link>
                        <span className={`block ${muted}`}>
                          {VACANCY_TYPE_LABELS[vacancy.type]} · {vacancy.location}
                        </span>
                      </td>
                      <td className={td}>
                        <span className={state.live ? 'text-msg-ok' : 'text-zinc-700'}>{state.label}</span>
                        <button
                          className={`block min-h-target cursor-pointer text-left text-[0.813rem] disabled:cursor-not-allowed disabled:opacity-60 ${linkText}`}
                          type="button"
                          disabled={busy}
                          onClick={() => void setPublished(vacancy, !vacancy.published)}
                          aria-label={`${vacancy.published ? 'Unpublish' : 'Publish'} ${vacancy.title}`}
                        >
                          {vacancy.published ? 'Unpublish' : 'Publish'}
                        </button>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {vacancy.closingDate ? formatClosingDate(vacancy.closingDate) : 'Open until filled'}
                      </td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>
                        {canReadApplications ? (
                          <Link
                            className="font-semibold text-ink underline decoration-zinc-300 underline-offset-4 hover:decoration-ink"
                            href={`/admin/applications?vacancy=${vacancy.id}`}
                            aria-label={`${formatNumber(vacancy.applicationCount)} applications for ${vacancy.title}`}
                          >
                            {formatNumber(vacancy.applicationCount)}
                          </Link>
                        ) : (
                          <span className="font-semibold text-ink">{formatNumber(vacancy.applicationCount)}</span>
                        )}
                        <span className={`block ${muted}`}>{formatNumber(vacancy.newApplicationCount)} new</span>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatDateTime(vacancy.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
