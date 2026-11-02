'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminService } from '@/lib/repositories/services';
import { ApiFailure, api } from '../../auth-client';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallOrange,
  formatDateTime,
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
 * Every service, drafts included, in the order the public site shows them —
 * `GET /api/admin/services`. Moving a row sends the whole new order to
 * `POST /api/admin/services/reorder`; publishing or unpublishing is a `PATCH`.
 */

export type { AdminService };

export function publishedText(service: Pick<AdminService, 'published'>): string {
  return service.published ? 'Published' : 'Draft';
}

export default function ServiceList() {
  const list = useResource<{ results: AdminService[] }>('/api/admin/services');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  function fail(failure: unknown): void {
    setMessage({
      text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.',
      bad: true,
    });
  }

  async function move(index: number, by: -1 | 1): Promise<void> {
    const services = list.data?.results;
    if (!services) return;
    const ids = services.map((service) => service.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);

    setBusy(true);
    setMessage(null);
    try {
      const reordered = await api<{ results: AdminService[] }>('/api/admin/services/reorder', {
        method: 'POST',
        json: { ids },
      });
      list.setData(() => reordered);
      setMessage({ text: 'Order saved. The public pages follow within a minute.', bad: false });
    } catch (failure) {
      fail(failure);
      // A 422 means the list was stale; show the current order.
      list.reload();
    } finally {
      setBusy(false);
    }
  }

  async function setPublished(service: AdminService, published: boolean): Promise<void> {
    if (
      !published &&
      !window.confirm(`Unpublish “${service.title}”? Its page leaves the public site within a minute.`)
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const saved = await api<AdminService>(`/api/admin/services/${service.id}`, {
        method: 'PATCH',
        json: { published },
      });
      list.setData((current) => ({
        results: current.results.map((item) =>
          item.id === saved.id ? { ...saved, projectCount: item.projectCount } : item,
        ),
      }));
      setMessage({
        text: published
          ? `“${saved.title}” is published. It appears on the site within a minute.`
          : `“${saved.title}” is unpublished.`,
        bad: false,
      });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const services = list.data?.results ?? [];

  return (
    <>
      <PageHeader label="Services" title="Services">
        The disciplines on the Services page, in the order shown there. Drafts are listed here but
        not on the public site; changes reach it within a minute.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className={muted} role={message?.bad ? 'alert' : 'status'}>
          {message ? (
            <span className={message.bad ? 'text-msg-bad' : 'text-msg-ok'}>{message.text}</span>
          ) : null}
        </p>
        <Link className={btnSmallOrange} href="/admin/services/new">
          New service
        </Link>
      </div>

      <section className={panel} aria-busy={list.loading || busy}>
        <div className={panelHead}>
          <h2 className={panelTitle}>Display order</h2>
          {list.data ? (
            <p className={muted}>
              {services.filter((service) => service.published).length} published of {services.length}
            </p>
          ) : null}
        </div>

        {services.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="There are no services yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse">
              <thead>
                <tr>
                  <th className={th} scope="col">Order</th>
                  <th className={th} scope="col">Service</th>
                  <th className={th} scope="col">Publication</th>
                  <th className={th} scope="col">Projects</th>
                  <th className={th} scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <tr key={service.id}>
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
                          aria-label={`Move ${service.title} up`}
                        >
                          ↑
                        </button>
                        <button
                          className={`${btnSmall} px-3`}
                          type="button"
                          disabled={busy || index === services.length - 1}
                          onClick={() => void move(index, 1)}
                          aria-label={`Move ${service.title} down`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className={`${td} max-w-xs`}>
                      <Link
                        className="font-semibold text-ink hover:text-rust"
                        href={`/admin/services/${service.id}`}
                      >
                        {service.title}
                      </Link>
                      <span className={`block break-all ${muted}`}>/services/{service.slug}</span>
                      {service.informational ? (
                        <span className={`block ${muted}`}>Informational only</span>
                      ) : null}
                    </td>
                    <td className={td}>
                      <span className={service.published ? 'text-msg-ok' : 'text-zinc-700'}>
                        {publishedText(service)}
                      </span>
                      <button
                        className={`block min-h-target cursor-pointer text-left text-[0.813rem] disabled:cursor-not-allowed disabled:opacity-60 ${linkText}`}
                        type="button"
                        disabled={busy}
                        onClick={() => void setPublished(service, !service.published)}
                        // A label rather than an sr-only span: that is absolutely
                        // positioned and escapes the table's scroll box on a phone.
                        aria-label={`${service.published ? 'Unpublish' : 'Publish'} ${service.title}`}
                      >
                        {service.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </td>
                    <td className={td}>
                      {service.projectCount ? service.projectCount : <span className={muted}>None</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(service.updatedAt)}</td>
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
