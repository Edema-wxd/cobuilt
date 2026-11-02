'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminVideo } from '@/lib/repositories/videos';
import { VIDEO_CATEGORY_LABEL, formatDuration } from '@/lib/videos';
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
 * Every video in the library, drafts included, in the order the public site
 * shows them — `GET /api/admin/videos`. Moving a row sends the whole new order
 * to `POST /api/admin/videos/reorder`; publishing and featuring are a `PATCH`.
 *
 * No YouTube thumbnails here either: the console is a page like any other,
 * and an editor's browser need not call Google to list the library.
 */

export type { AdminVideo };

export function publishedText(video: Pick<AdminVideo, 'published'>): string {
  return video.published ? 'Published' : 'Draft';
}

/** A row's text toggle: publish and feature. */
const toggle = `block min-h-target cursor-pointer text-left text-[0.813rem] disabled:cursor-not-allowed disabled:opacity-60 ${linkText}`;

export default function VideoList() {
  const list = useResource<{ results: AdminVideo[] }>('/api/admin/videos');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  function fail(failure: unknown): void {
    setMessage({
      text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.',
      bad: true,
    });
  }

  async function move(index: number, by: -1 | 1): Promise<void> {
    const videos = list.data?.results;
    if (!videos) return;
    const ids = videos.map((video) => video.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);

    setBusy(true);
    setMessage(null);
    try {
      const reordered = await api<{ results: AdminVideo[] }>('/api/admin/videos/reorder', {
        method: 'POST',
        json: { ids },
      });
      list.setData(() => reordered);
      setMessage({ text: 'Order saved. The video library follows within a minute.', bad: false });
    } catch (failure) {
      fail(failure);
      // A 422 means the list was stale; show the current order.
      list.reload();
    } finally {
      setBusy(false);
    }
  }

  async function patch(
    video: AdminVideo,
    changes: { published?: boolean; featured?: boolean },
    done: (saved: AdminVideo) => string,
  ): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api<AdminVideo>(`/api/admin/videos/${video.id}`, { method: 'PATCH', json: changes });
      list.setData((current) => ({
        results: current.results.map((item) => (item.id === saved.id ? saved : item)),
      }));
      setMessage({ text: done(saved), bad: false });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  function setPublished(video: AdminVideo, published: boolean): void {
    if (
      !published &&
      !window.confirm(`Unpublish “${video.title}”? It leaves the video library within a minute.`)
    ) {
      return;
    }
    void patch(video, { published }, (saved) =>
      published
        ? `“${saved.title}” is published. It appears in the library within a minute.`
        : `“${saved.title}” is unpublished.`,
    );
  }

  const videos = list.data?.results ?? [];
  // The library page leads with the first featured, published video in this order.
  const lead = videos.find((video) => video.featured && video.published) ?? null;

  return (
    <>
      <PageHeader label="Videos" title="Video library">
        The films on the Videos page, in the order shown there. The first featured film leads the
        page. Drafts are listed here but not on the public site; changes reach it within a minute.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className={muted} role={message?.bad ? 'alert' : 'status'}>
          {message ? (
            <span className={message.bad ? 'text-msg-bad' : 'text-msg-ok'}>{message.text}</span>
          ) : null}
        </p>
        <Link className={btnSmallOrange} href="/admin/videos/new">
          Add a video
        </Link>
      </div>

      <section className={panel} aria-busy={list.loading || busy}>
        <div className={panelHead}>
          <h2 className={panelTitle}>Display order</h2>
          {list.data ? (
            <p className={muted}>
              {videos.filter((video) => video.published).length} published of {videos.length}
            </p>
          ) : null}
        </div>

        {videos.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="There are no videos yet. Add one with a link from the CoBuilt YouTube channel."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl border-collapse">
              <thead>
                <tr>
                  <th className={th} scope="col">Order</th>
                  <th className={th} scope="col">Video</th>
                  <th className={th} scope="col">Project</th>
                  <th className={th} scope="col">Publication</th>
                  <th className={th} scope="col">Featured</th>
                  <th className={th} scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video, index) => (
                  <tr key={video.id}>
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
                          aria-label={`Move ${video.title} up`}
                        >
                          ↑
                        </button>
                        <button
                          className={`${btnSmall} px-3`}
                          type="button"
                          disabled={busy || index === videos.length - 1}
                          onClick={() => void move(index, 1)}
                          aria-label={`Move ${video.title} down`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className={`${td} max-w-xs`}>
                      <Link className="font-semibold text-ink hover:text-rust" href={`/admin/videos/${video.id}`}>
                        {video.title}
                      </Link>
                      <span className={`block ${muted}`}>
                        {VIDEO_CATEGORY_LABEL[video.category]}
                        {formatDuration(video.durationSeconds) ? ` · ${formatDuration(video.durationSeconds)}` : ''}
                      </span>
                      <span className={`block break-all ${muted}`}>/videos/{video.slug}</span>
                    </td>
                    <td className={`${td} max-w-48`}>
                      {video.project ? (
                        <>
                          <span className="break-words">{video.project.title}</span>
                          {!video.project.isPublished ? (
                            <span className={`block ${muted}`}>Not published — not linked yet</span>
                          ) : null}
                        </>
                      ) : (
                        <span className={muted}>None</span>
                      )}
                    </td>
                    <td className={td}>
                      <span className={video.published ? 'text-msg-ok' : 'text-zinc-700'}>
                        {publishedText(video)}
                      </span>
                      <button
                        className={toggle}
                        type="button"
                        disabled={busy}
                        onClick={() => setPublished(video, !video.published)}
                        // A label rather than an sr-only span: that is absolutely
                        // positioned and escapes the table's scroll box on a phone.
                        aria-label={`${video.published ? 'Unpublish' : 'Publish'} ${video.title}`}
                      >
                        {video.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </td>
                    <td className={td}>
                      <span className={video.featured ? 'text-msg-ok' : 'text-zinc-700'}>
                        {video.featured ? (lead?.id === video.id ? 'Leads the page' : 'Featured') : 'No'}
                      </span>
                      <button
                        className={toggle}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void patch(video, { featured: !video.featured }, (saved) =>
                            saved.featured
                              ? `“${saved.title}” is featured.`
                              : `“${saved.title}” is no longer featured.`,
                          )
                        }
                        aria-label={`${video.featured ? 'Stop featuring' : 'Feature'} ${video.title}`}
                      >
                        {video.featured ? 'Stop featuring' : 'Feature'}
                      </button>
                      {video.featured && !video.published ? (
                        <span className={`block ${muted}`}>Shown once published</span>
                      ) : null}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(video.updatedAt)}</td>
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
