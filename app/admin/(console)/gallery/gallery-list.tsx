'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GALLERY_CATEGORY_LABEL } from '@/lib/gallery';
import type { AdminGalleryAlbum } from '@/lib/repositories/gallery';
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
 * Every album, drafts and empty ones included, in the order `/gallery` shows
 * them — `GET /api/admin/gallery`. Moving a row sends the whole new order to
 * `POST /api/admin/gallery/reorder`; publishing or unpublishing is a `PATCH`.
 */

export type { AdminGalleryAlbum };

/** What the public site does with the album, in words. */
export function albumStateText(album: Pick<AdminGalleryAlbum, 'published' | 'imageCount'>): string {
  if (!album.published) return 'Draft';
  return album.imageCount > 0 ? 'Published' : 'Published · hidden until it has a photograph';
}

export default function GalleryList() {
  const list = useResource<{ results: AdminGalleryAlbum[] }>('/api/admin/gallery');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  function fail(failure: unknown): void {
    setMessage({
      text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.',
      bad: true,
    });
  }

  async function move(index: number, by: -1 | 1): Promise<void> {
    const albums = list.data?.results;
    if (!albums) return;
    const ids = albums.map((album) => album.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);

    setBusy(true);
    setMessage(null);
    try {
      const reordered = await api<{ results: AdminGalleryAlbum[] }>('/api/admin/gallery/reorder', {
        method: 'POST',
        json: { ids },
      });
      list.setData(() => reordered);
      setMessage({ text: 'Order saved. The gallery follows within a minute.', bad: false });
    } catch (failure) {
      fail(failure);
      // A 422 means the list was stale; show the current order.
      list.reload();
    } finally {
      setBusy(false);
    }
  }

  async function setPublished(album: AdminGalleryAlbum, published: boolean): Promise<void> {
    if (
      !published &&
      !window.confirm(`Unpublish “${album.title}”? It leaves the public gallery within a minute.`)
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const saved = await api<AdminGalleryAlbum>(`/api/admin/gallery/${album.id}`, {
        method: 'PATCH',
        json: { published },
      });
      list.setData((current) => ({
        results: current.results.map((item) => (item.id === saved.id ? saved : item)),
      }));
      setMessage({
        text: published
          ? saved.imageCount > 0
            ? `“${saved.title}” is published. It appears in the gallery within a minute.`
            : `“${saved.title}” is published, and appears once it has a photograph.`
          : `“${saved.title}” is unpublished.`,
        bad: false,
      });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const albums = list.data?.results ?? [];

  return (
    <>
      <PageHeader label="Gallery" title="Image gallery">
        The albums on the Gallery page, in the order shown there. Drafts, and albums with no
        photographs yet, are listed here but not on the public site; changes reach it within a
        minute.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className={muted} role={message?.bad ? 'alert' : 'status'}>
          {message ? (
            <span className={message.bad ? 'text-msg-bad' : 'text-msg-ok'}>{message.text}</span>
          ) : null}
        </p>
        <Link className={btnSmallOrange} href="/admin/gallery/new">
          New album
        </Link>
      </div>

      <section className={panel} aria-busy={list.loading || busy}>
        <div className={panelHead}>
          <h2 className={panelTitle}>Display order</h2>
          {list.data ? (
            <p className={muted}>
              {albums.filter((album) => album.published && album.imageCount > 0).length} on the site of{' '}
              {albums.length}
            </p>
          ) : null}
        </div>

        {albums.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="There are no albums yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl border-collapse">
              <thead>
                <tr>
                  <th className={th} scope="col">Order</th>
                  <th className={th} scope="col">Album</th>
                  <th className={th} scope="col">Photographs</th>
                  <th className={th} scope="col">Publication</th>
                  <th className={th} scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {albums.map((album, index) => (
                  <tr key={album.id}>
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
                          aria-label={`Move ${album.title} up`}
                        >
                          ↑
                        </button>
                        <button
                          className={`${btnSmall} px-3`}
                          type="button"
                          disabled={busy || index === albums.length - 1}
                          onClick={() => void move(index, 1)}
                          aria-label={`Move ${album.title} down`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className={`${td} max-w-xs`}>
                      <Link className="font-semibold text-ink hover:text-rust" href={`/admin/gallery/${album.id}`}>
                        {album.title}
                      </Link>
                      <span className={`block ${muted}`}>
                        {GALLERY_CATEGORY_LABEL[album.category]}
                        {album.project ? ` · ${album.project.title}` : ''}
                      </span>
                      <span className={`block break-all ${muted}`}>/gallery/{album.slug}</span>
                    </td>
                    <td className={`${td} tabular-nums`}>
                      {album.imageCount > 0 ? album.imageCount : <span className={muted}>None yet</span>}
                    </td>
                    <td className={td}>
                      <span
                        className={album.published && album.imageCount > 0 ? 'text-msg-ok' : 'text-zinc-700'}
                      >
                        {albumStateText(album)}
                      </span>
                      <button
                        className={`block min-h-target cursor-pointer text-left text-[0.813rem] disabled:cursor-not-allowed disabled:opacity-60 ${linkText}`}
                        type="button"
                        disabled={busy}
                        onClick={() => void setPublished(album, !album.published)}
                        // A label rather than an sr-only span: that is absolutely
                        // positioned and escapes the table's scroll box on a phone.
                        aria-label={`${album.published ? 'Unpublish' : 'Publish'} ${album.title}`}
                      >
                        {album.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(album.updatedAt)}</td>
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
