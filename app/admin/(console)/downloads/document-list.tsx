'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminDocument } from '@/lib/repositories/documents';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/lib/documentCategories';
import { fileFacts } from '../../../../components/documents';
import { ApiFailure, api } from '../../auth-client';
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
 * The download centre — `GET /api/admin/documents`. Documents are grouped by
 * category, as `/resources` shows them, in display order within each group.
 * Moving a row sends the whole new order to `POST
 * /api/admin/documents/reorder`; publishing or unpublishing is a `PATCH`.
 *
 * Download counts are the business metric the client asked for: the all-time
 * total and the last 30 days, counted by the download endpoint with nothing
 * stored about who downloaded (docs/decisions.md §2.25).
 */

export type { AdminDocument };

/** Group headings: plural where the public page is. */
export const GROUP_TITLES: Record<DocumentCategory, string> = {
  company_profile: 'Company profile',
  capability_statement: 'Capability statement',
  brochure: 'Brochures',
  project_profile: 'Project profiles',
  policy: 'Policy documents',
  other: 'Other documents',
};

export function publicationText(document: Pick<AdminDocument, 'published' | 'project'>): string {
  if (!document.published) return 'Draft';
  // A published document on an unpublished project is held back with the project.
  return document.project && !document.project.isPublished ? 'Waiting on its project' : 'Published';
}

/** The documents in display order, grouped by category in the public page's order. */
function grouped(documents: AdminDocument[]): Array<{ category: DocumentCategory; documents: AdminDocument[] }> {
  return DOCUMENT_CATEGORIES.map((category) => ({
    category,
    documents: documents.filter((document) => document.category === category),
  })).filter((group) => group.documents.length > 0);
}

export default function DocumentList() {
  const list = useResource<{ results: AdminDocument[] }>('/api/admin/documents');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  function fail(failure: unknown): void {
    setMessage({
      text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.',
      bad: true,
    });
  }

  /** Moves a document within its group; the whole list is sent, group by group. */
  async function move(category: DocumentCategory, index: number, by: -1 | 1): Promise<void> {
    const documents = list.data?.results;
    if (!documents) return;
    const ids = grouped(documents).flatMap((group) => {
      const groupIds = group.documents.map((document) => document.id);
      if (group.category === category) {
        const [moved] = groupIds.splice(index, 1);
        groupIds.splice(index + by, 0, moved!);
      }
      return groupIds;
    });

    setBusy(true);
    setMessage(null);
    try {
      const reordered = await api<{ results: AdminDocument[] }>('/api/admin/documents/reorder', {
        method: 'POST',
        json: { ids },
      });
      list.setData(() => reordered);
      setMessage({ text: 'Order saved. The Resources page follows within a minute.', bad: false });
    } catch (failure) {
      fail(failure);
      // A 422 means the list was stale; show the current order.
      list.reload();
    } finally {
      setBusy(false);
    }
  }

  async function setPublished(document: AdminDocument, published: boolean): Promise<void> {
    if (
      !published &&
      !window.confirm(`Unpublish “${document.title}”? It leaves the Resources page, and its download link stops working.`)
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const saved = await api<AdminDocument>(`/api/admin/documents/${document.id}`, {
        method: 'PATCH',
        json: { published },
      });
      list.setData((current) => ({
        results: current.results.map((item) =>
          item.id === saved.id ? { ...saved, downloadsLast30Days: item.downloadsLast30Days } : item,
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

  const documents = list.data?.results ?? [];
  const groups = grouped(documents);
  const total = documents.reduce((sum, document) => sum + document.downloadCount, 0);
  const recent = documents.reduce((sum, document) => sum + (document.downloadsLast30Days ?? 0), 0);

  return (
    <>
      <PageHeader label="Resources" title="Downloads">
        The documents in the download centre on the Resources page, grouped as visitors see them.
        Drafts are listed here but not on the site; changes reach it within a minute.{' '}
        <a className={linkText} href="/resources" target="_blank" rel="noopener noreferrer">
          View the Resources page<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className={muted} role={message?.bad ? 'alert' : 'status'}>
          {message ? (
            <span className={message.bad ? 'text-msg-bad' : 'text-msg-ok'}>{message.text}</span>
          ) : list.data ? (
            `${formatNumber(total)} ${total === 1 ? 'download' : 'downloads'} in all · ${formatNumber(recent)} in the last 30 days`
          ) : null}
        </p>
        <Link className={btnSmallOrange} href="/admin/downloads/new">
          Add a document
        </Link>
      </div>

      {groups.length === 0 ? (
        <section className={panel} aria-busy={list.loading}>
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="There are no documents yet. Add the company profile first: it is what most visitors look for."
          />
        </section>
      ) : (
        <div className="flex flex-col gap-6" aria-busy={list.loading || busy}>
          {groups.map((group) => (
            <section key={group.category} className={panel} aria-labelledby={`group-${group.category}`}>
              <div className={panelHead}>
                <h2 className={panelTitle} id={`group-${group.category}`}>
                  {GROUP_TITLES[group.category]}
                </h2>
                <p className={muted}>
                  {group.documents.filter((document) => publicationText(document) === 'Published').length} on
                  the site of {group.documents.length}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-3xl border-collapse">
                  <thead>
                    <tr>
                      <th className={th} scope="col">Order</th>
                      <th className={th} scope="col">Document</th>
                      <th className={th} scope="col">Publication</th>
                      <th className={th} scope="col">Downloads</th>
                      <th className={th} scope="col">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.documents.map((document, index) => (
                      <tr key={document.id}>
                        <td className={`${td} whitespace-nowrap`}>
                          <div className="flex items-center gap-2">
                            <span className="w-6 font-mono text-[0.813rem] text-zinc-600">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <button
                              className={`${btnSmall} px-3`}
                              type="button"
                              disabled={busy || index === 0}
                              onClick={() => void move(group.category, index, -1)}
                              aria-label={`Move ${document.title} up`}
                            >
                              ↑
                            </button>
                            <button
                              className={`${btnSmall} px-3`}
                              type="button"
                              disabled={busy || index === group.documents.length - 1}
                              onClick={() => void move(group.category, index, 1)}
                              aria-label={`Move ${document.title} down`}
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                        <td className={`${td} max-w-xs`}>
                          <Link
                            className="font-semibold break-words text-ink hover:text-rust"
                            href={`/admin/downloads/${document.id}`}
                          >
                            {document.title}
                          </Link>
                          <span className={`block ${muted}`}>
                            {fileFacts(document.fileType, document.fileSizeBytes)} ·{' '}
                            {document.fileKey ? 'Uploaded' : 'Linked'}
                          </span>
                          {document.project ? (
                            <span className={`block break-words ${muted}`}>{document.project.title}</span>
                          ) : null}
                        </td>
                        <td className={td}>
                          <span className={publicationText(document) === 'Published' ? 'text-msg-ok' : 'text-zinc-700'}>
                            {publicationText(document)}
                          </span>
                          <button
                            className={`block min-h-target cursor-pointer text-left text-[0.813rem] disabled:cursor-not-allowed disabled:opacity-60 ${linkText}`}
                            type="button"
                            disabled={busy}
                            onClick={() => void setPublished(document, !document.published)}
                            aria-label={`${document.published ? 'Unpublish' : 'Publish'} ${document.title}`}
                          >
                            {document.published ? 'Unpublish' : 'Publish'}
                          </button>
                        </td>
                        <td className={`${td} whitespace-nowrap tabular-nums`}>
                          <span className="font-semibold text-ink">{formatNumber(document.downloadCount)}</span>
                          <span className={`block ${muted}`}>
                            {formatNumber(document.downloadsLast30Days ?? 0)} in 30 days
                          </span>
                        </td>
                        <td className={`${td} whitespace-nowrap`}>{formatDateTime(document.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
