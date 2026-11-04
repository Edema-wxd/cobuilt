'use client';

import { useEffect, useRef, useState } from 'react';
import { genUploader } from 'uploadthing/client';
import { ALT_TEXT_MAX, CAPTION_MAX, GALLERY_UPLOAD } from '@/lib/gallery';
import type { AdminGalleryAlbumDetail, AdminGalleryImage } from '@/lib/repositories/gallery';
import type { UploadRouter } from '@/lib/storage/uploadthing';
import { FillImage } from '../../../gallery/gallery-shared';
import { ApiFailure, api, authHeaders } from '../../auth-client';
import { btnSmall, btnSmallDanger, btnSmallOrange, muted, panel, panelHead, panelTitle } from '../../kit';
import { Field, fieldLabel, input, textarea } from '../../form-kit';

/**
 * An album's photographs in the console:
 *
 *   - upload: files go straight from the browser to UploadThing (the
 *     `galleryImage` route, authorised by the console's bearer token), with
 *     progress, then are registered with `POST
 *     /api/admin/gallery/[id]/images` — the tour upload's flow
 *     (docs/decisions.md §2.2). Each file needs its alt text before the
 *     upload starts, so no photograph reaches the site undescribed;
 *   - add by link: an https URL, or a path on this site;
 *   - per photograph: alt text, caption and date (`PATCH`), order (`POST
 *     …/images/reorder`, the whole list), cover (`PATCH` on the album) and
 *     delete (`DELETE`, which deletes an uploaded file from storage too).
 */

type Album = AdminGalleryAlbumDetail;
type AlbumUpdate = (update: (current: Album) => Album) => void;

const { uploadFiles } = genUploader<UploadRouter>({ package: 'uploadthing' });

function failureText(failure: unknown): string {
  return failure instanceof ApiFailure ? failure.message : 'No connection to the server.';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** What is wrong with a file before it is uploaded, if anything. */
function fileProblem(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (
    !(GALLERY_UPLOAD.extensions as readonly string[]).includes(extension) ||
    !(GALLERY_UPLOAD.mimeTypes as readonly string[]).includes(file.type)
  ) {
    return `“${file.name}” is not a JPEG, PNG or WebP image.`;
  }
  if (file.size > GALLERY_UPLOAD.maxFileBytes) {
    return `“${file.name}” is ${formatBytes(file.size)}; the limit is ${formatBytes(GALLERY_UPLOAD.maxFileBytes)}.`;
  }
  return null;
}

/**
 * The pixel size of an image, read in the browser so the public pages can
 * reserve its shape. Null when it cannot be read (or takes too long): the
 * size is optional, and the pages fall back to a fixed frame.
 */
function measure(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), 8000);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image.naturalWidth > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : null);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });
}

export default function ImageManager({ album, onChange }: { album: Album; onChange: AlbumUpdate }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const images = album.images;
  // The card shows the chosen cover, else the first photograph.
  const coverId = album.coverImageId ?? images[0]?.id ?? null;

  async function run(action: () => Promise<string>): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ text: await action(), bad: false });
    } catch (failure) {
      setMessage({ text: failureText(failure), bad: true });
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, by: -1 | 1): Promise<void> {
    return run(async () => {
      const ids = images.map((image) => image.id);
      const [moved] = ids.splice(index, 1);
      ids.splice(index + by, 0, moved!);
      try {
        const { results } = await api<{ results: AdminGalleryImage[] }>(
          `/api/admin/gallery/${album.id}/images/reorder`,
          { method: 'POST', json: { ids } },
        );
        onChange((current) => ({ ...current, images: results }));
      } catch (failure) {
        // A 422 means the list was stale (someone else added or removed one).
        if (failure instanceof ApiFailure && failure.status === 422) await reload();
        throw failure;
      }
      return 'Order saved.';
    });
  }

  async function reload(): Promise<void> {
    const fresh = await api<Album>(`/api/admin/gallery/${album.id}`);
    onChange(() => fresh);
  }

  function makeCover(image: AdminGalleryImage): Promise<void> {
    return run(async () => {
      const saved = await api<Album>(`/api/admin/gallery/${album.id}`, {
        method: 'PATCH',
        json: { coverImageId: image.id },
      });
      onChange(() => saved);
      return 'Cover set. The gallery follows within a minute.';
    });
  }

  function remove(image: AdminGalleryImage): Promise<void> {
    const stored = image.fileKey ? ' The uploaded file is deleted from storage too.' : '';
    if (!window.confirm(`Delete this photograph (“${image.alt}”)?${stored} This cannot be undone.`)) {
      return Promise.resolve();
    }
    return run(async () => {
      await api<void>(`/api/admin/gallery/${album.id}/images/${image.id}`, { method: 'DELETE' });
      onChange((current) => ({
        ...current,
        images: current.images.filter((item) => item.id !== image.id),
        imageCount: current.imageCount - 1,
        coverImageId: current.coverImageId === image.id ? null : current.coverImageId,
      }));
      return 'Photograph deleted.';
    });
  }

  function added(results: AdminGalleryImage[]): void {
    onChange((current) => ({
      ...current,
      images: [...current.images, ...results],
      imageCount: current.imageCount + results.length,
    }));
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <section className={panel} aria-busy={busy} aria-labelledby="g-images-title">
        <div className={panelHead}>
          <h2 id="g-images-title" className={panelTitle}>
            Photographs
          </h2>
          <p className={muted}>
            {images.length} in this album{images.length > 0 ? ', in the order shown on the site' : ''}
          </p>
        </div>

        {message ? (
          <p
            className={`border-b border-line px-5 py-3 text-[0.813rem] ${message.bad ? 'text-msg-bad' : 'text-msg-ok'}`}
            role={message.bad ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        ) : null}

        {images.length === 0 ? (
          <p className={`px-5 py-8 ${muted}`}>
            No photographs yet. Upload some below; the album appears on the site once it has one and is
            published.
          </p>
        ) : (
          <ol>
            {images.map((image, index) => (
              <ImageRow
                key={`${image.id}:${image.updatedAt}`}
                albumId={album.id}
                image={image}
                index={index}
                count={images.length}
                isCover={image.id === coverId}
                coverChosen={album.coverImageId !== null}
                busy={busy}
                onMove={(by) => void move(index, by)}
                onCover={() => void makeCover(image)}
                onDelete={() => void remove(image)}
                onSaved={(saved) =>
                  onChange((current) => ({
                    ...current,
                    images: current.images.map((item) => (item.id === saved.id ? saved : item)),
                  }))
                }
              />
            ))}
          </ol>
        )}
      </section>

      <Uploader albumId={album.id} room={GALLERY_UPLOAD.maxFileCount} onAdded={added} />
      <LinkAdder albumId={album.id} onAdded={added} />
    </div>
  );
}

function ImageRow({
  albumId,
  image,
  index,
  count,
  isCover,
  coverChosen,
  busy,
  onMove,
  onCover,
  onDelete,
  onSaved,
}: {
  albumId: string;
  image: AdminGalleryImage;
  index: number;
  count: number;
  isCover: boolean;
  coverChosen: boolean;
  busy: boolean;
  onMove: (by: -1 | 1) => void;
  onCover: () => void;
  onDelete: () => void;
  onSaved: (saved: AdminGalleryImage) => void;
}) {
  const initial = { alt: image.alt, caption: image.caption ?? '', takenOn: image.takenOn ?? '' };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const id = `g-image-${image.id}`;
  const number = index + 1;

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const changes: Record<string, string | null> = {};
    if (form.alt.trim() !== image.alt) changes.altText = form.alt.trim();
    if ((form.caption.trim() || null) !== image.caption) changes.caption = form.caption.trim() || null;
    if ((form.takenOn || null) !== image.takenOn) changes.takenOn = form.takenOn || null;
    if (Object.keys(changes).length === 0) return;

    setSaving(true);
    setError('');
    try {
      onSaved(
        await api<AdminGalleryImage>(`/api/admin/gallery/${albumId}/images/${image.id}`, {
          method: 'PATCH',
          json: changes,
        }),
      );
    } catch (failure) {
      setError(failureText(failure));
      setSaving(false);
    }
  }

  return (
    <li className="border-b border-line px-5 py-5 last:border-b-0">
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6"
        onSubmit={(event) => void save(event)}
        aria-label={`Photograph ${number}`}
      >
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[4/3] w-full max-w-60 overflow-hidden bg-line md:max-w-none">
            <FillImage src={image.url} alt={image.alt} sizes="240px" />
          </div>
          <p className={`font-mono ${muted}`}>
            {String(number).padStart(2, '0')}
            {image.width && image.height ? ` · ${image.width}×${image.height}` : ''}
            {image.fileKey ? ' · uploaded' : ' · linked'}
          </p>
          {isCover ? (
            <p className="text-[0.813rem] font-semibold text-msg-ok">
              Cover{coverChosen ? '' : ' (first photograph)'}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Field
            id={`${id}-alt`}
            label="Alt text"
            hint="What the photograph shows, for people who cannot see it. Required."
          >
            <textarea
              id={`${id}-alt`}
              className={`${textarea} min-h-16`}
              required
              minLength={3}
              maxLength={ALT_TEXT_MAX}
              value={form.alt}
              disabled={saving}
              onChange={(event) => setForm({ ...form, alt: event.target.value })}
              aria-describedby={`${id}-alt-hint`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field id={`${id}-caption`} label="Caption" optional>
              <input
                id={`${id}-caption`}
                className={input}
                maxLength={CAPTION_MAX}
                value={form.caption}
                disabled={saving}
                onChange={(event) => setForm({ ...form, caption: event.target.value })}
              />
            </Field>
            <Field id={`${id}-taken`} label="Date taken" optional>
              <input
                id={`${id}-taken`}
                className={input}
                type="date"
                value={form.takenOn}
                disabled={saving}
                onChange={(event) => setForm({ ...form, takenOn: event.target.value })}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className={btnSmallOrange} type="submit" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save'}
              <span className="sr-only"> photograph {number}</span>
            </button>
            <button
              className={`${btnSmall} px-3`}
              type="button"
              disabled={busy || index === 0}
              onClick={() => onMove(-1)}
              aria-label={`Move photograph ${number} up`}
            >
              ↑
            </button>
            <button
              className={`${btnSmall} px-3`}
              type="button"
              disabled={busy || index === count - 1}
              onClick={() => onMove(1)}
              aria-label={`Move photograph ${number} down`}
            >
              ↓
            </button>
            {!isCover || !coverChosen ? (
              <button className={btnSmall} type="button" disabled={busy} onClick={onCover}>
                Make cover<span className="sr-only"> (photograph {number})</span>
              </button>
            ) : null}
            <button className={btnSmallDanger} type="button" disabled={busy} onClick={onDelete}>
              Delete<span className="sr-only"> photograph {number}</span>
            </button>
          </div>
          {error ? (
            <p className="text-[0.813rem] text-msg-bad" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </li>
  );
}

interface Staged {
  key: number;
  file: File;
  preview: string;
  alt: string;
  caption: string;
}

type Stage = { step: 'idle' } | { step: 'uploading'; fraction: number } | { step: 'registering' };

/**
 * Choose files, describe each, then upload them together. Alt text is asked
 * for here rather than after the fact, so nothing is published undescribed.
 */
function Uploader({
  albumId,
  room,
  onAdded,
}: {
  albumId: string;
  room: number;
  onAdded: (results: AdminGalleryImage[]) => void;
}) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [stage, setStage] = useState<Stage>({ step: 'idle' });
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  // Bumped to clear the file input, which cannot be controlled.
  const [inputKey, setInputKey] = useState(0);
  const nextKey = useRef(0);
  const previews = useRef<string[]>([]);
  const busy = stage.step !== 'idle';

  // Releases the previews' object URLs when the panel goes away.
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function choose(files: FileList | null): void {
    setMessage(null);
    const chosen = Array.from(files ?? []);
    const problems = chosen.map(fileProblem).filter((problem): problem is string => problem !== null);
    const accepted = chosen.filter((file) => fileProblem(file) === null).slice(0, room - staged.length);
    const dropped = chosen.length - problems.length - accepted.length;

    const added = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { key: nextKey.current++, file, preview, alt: '', caption: '' };
    });
    setStaged((current) => [...current, ...added]);
    setInputKey((n) => n + 1);

    const notes = [...problems];
    if (dropped > 0) notes.push(`Upload at most ${room} at a time; ${dropped} left out.`);
    if (notes.length > 0) setMessage({ text: notes.join(' '), bad: true });
  }

  function unstage(key: number): void {
    setStaged((current) => {
      const item = current.find((entry) => entry.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((entry) => entry.key !== key);
    });
  }

  async function upload(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (staged.length === 0) return;
    setMessage(null);

    try {
      const sizes = await Promise.all(staged.map((item) => measure(item.preview)));

      setStage({ step: 'uploading', fraction: 0 });
      let uploaded;
      try {
        uploaded = await uploadFiles('galleryImage', {
          files: staged.map((item) => item.file),
          headers: await authHeaders(),
          onUploadProgress: ({ totalProgress }) => setStage({ step: 'uploading', fraction: totalProgress / 100 }),
        });
      } catch (failure) {
        if (failure instanceof ApiFailure) throw failure;
        // UploadThing errors carry the middleware's own message (role, size, type).
        const text = failure instanceof Error ? failure.message : '';
        throw new ApiFailure(0, text || 'The upload failed. Check your connection, then try again.');
      }

      // Results come back per file; matched by name and size, then position.
      const remaining = [...uploaded];
      const keys = staged.map((item, index) => {
        const match = remaining.findIndex((file) => file.name === item.file.name && file.size === item.file.size);
        const [file] = remaining.splice(match >= 0 ? match : 0, 1);
        return file?.key ?? uploaded[index]?.key;
      });
      if (keys.some((key) => !key)) throw new ApiFailure(0, 'Not every file was returned by storage.');

      setStage({ step: 'registering' });
      const { results } = await api<{ results: AdminGalleryImage[] }>(`/api/admin/gallery/${albumId}/images`, {
        method: 'POST',
        json: {
          images: staged.map((item, index) => ({
            fileKey: keys[index],
            altText: item.alt.trim(),
            ...(item.caption.trim() ? { caption: item.caption.trim() } : {}),
            ...(sizes[index] ?? {}),
          })),
        },
      });

      staged.forEach((item) => URL.revokeObjectURL(item.preview));
      setStaged([]);
      onAdded(results);
      setMessage({
        text: `${results.length} ${results.length === 1 ? 'photograph' : 'photographs'} added.`,
        bad: false,
      });
    } catch (failure) {
      setMessage({ text: failureText(failure), bad: true });
    } finally {
      setStage({ step: 'idle' });
    }
  }

  const submitLabel =
    stage.step === 'uploading'
      ? `Uploading ${Math.round(stage.fraction * 100)}%`
      : stage.step === 'registering'
        ? 'Saving…'
        : staged.length === 0
          ? 'Upload photographs'
          : `Upload ${staged.length} ${staged.length === 1 ? 'photograph' : 'photographs'}`;

  return (
    <section className={panel} aria-labelledby="g-upload-title">
      <div className={panelHead}>
        <h2 id="g-upload-title" className={panelTitle}>
          Upload photographs
        </h2>
        <p className={muted}>
          JPEG, PNG or WebP · up to {formatBytes(GALLERY_UPLOAD.maxFileBytes)} each · {room} at a time
        </p>
      </div>

      <form className="flex flex-col gap-5 px-5 py-5" onSubmit={(event) => void upload(event)}>
        <div className="flex flex-col gap-1.75">
          <label className={fieldLabel} htmlFor="g-upload-files">
            Choose files
          </label>
          <input
            key={inputKey}
            id="g-upload-files"
            className="min-h-target max-w-full text-[0.875rem] text-ink file:mr-3 file:min-h-target file:cursor-pointer file:border file:border-zinc-300 file:bg-white file:px-4 file:text-[0.688rem] file:font-semibold file:tracking-[0.14em] file:text-ink file:uppercase"
            type="file"
            multiple
            accept={GALLERY_UPLOAD.mimeTypes.join(',')}
            disabled={busy || staged.length >= room}
            onChange={(event) => choose(event.target.files)}
            aria-describedby="g-upload-files-hint"
          />
          <p id="g-upload-files-hint" className={muted}>
            Upload the largest version you have: the site serves each visitor a copy sized for their
            screen. Describe each photograph below before uploading.
          </p>
        </div>

        {staged.length > 0 ? (
          <ol className="flex flex-col border border-zinc-300">
            {staged.map((item, index) => (
              <li
                key={item.key}
                className="grid grid-cols-1 gap-4 border-b border-line p-4 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                {/* A local preview of a file not yet uploaded: next/image cannot serve a blob: URL. */}
                <img className="aspect-[4/3] w-full max-w-48 bg-line object-cover" src={item.preview} alt="" />
                <div className="flex min-w-0 flex-col gap-3">
                  <p className={`break-all ${muted}`}>
                    {item.file.name} · {formatBytes(item.file.size)}
                  </p>
                  <Field id={`g-new-${item.key}-alt`} label={`Alt text for file ${index + 1}`}>
                    <textarea
                      id={`g-new-${item.key}-alt`}
                      className={`${textarea} min-h-16`}
                      required
                      minLength={3}
                      maxLength={ALT_TEXT_MAX}
                      value={item.alt}
                      disabled={busy}
                      placeholder="What the photograph shows"
                      onChange={(event) =>
                        setStaged((current) =>
                          current.map((entry) => (entry.key === item.key ? { ...entry, alt: event.target.value } : entry)),
                        )
                      }
                    />
                  </Field>
                  <Field id={`g-new-${item.key}-caption`} label="Caption" optional>
                    <input
                      id={`g-new-${item.key}-caption`}
                      className={input}
                      maxLength={CAPTION_MAX}
                      value={item.caption}
                      disabled={busy}
                      onChange={(event) =>
                        setStaged((current) =>
                          current.map((entry) =>
                            entry.key === item.key ? { ...entry, caption: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </Field>
                  <div>
                    <button className={btnSmall} type="button" disabled={busy} onClick={() => unstage(item.key)}>
                      Remove<span className="sr-only"> {item.file.name}</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {stage.step === 'uploading' ? (
          <progress
            className="h-1.5 w-full appearance-none overflow-hidden bg-line [&::-moz-progress-bar]:bg-orange [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-orange"
            max={1}
            value={stage.fraction}
            aria-label="Upload progress"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button className={btnSmallOrange} type="submit" disabled={busy || staged.length === 0}>
            {submitLabel}
          </button>
          {message ? (
            <p
              className={`text-[0.813rem] ${message.bad ? 'text-msg-bad' : 'text-msg-ok'}`}
              role={message.bad ? 'alert' : 'status'}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/** Adds a photograph already hosted elsewhere, or a file on this site. */
function LinkAdder({ albumId, onAdded }: { albumId: string; onAdded: (results: AdminGalleryImage[]) => void }) {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  async function add(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const imageUrl = url.trim();
      const size = await measure(imageUrl);
      const { results } = await api<{ results: AdminGalleryImage[] }>(`/api/admin/gallery/${albumId}/images`, {
        method: 'POST',
        json: {
          images: [
            {
              imageUrl,
              altText: alt.trim(),
              ...(caption.trim() ? { caption: caption.trim() } : {}),
              ...(size ?? {}),
            },
          ],
        },
      });
      onAdded(results);
      setUrl('');
      setAlt('');
      setCaption('');
      setMessage({
        text: size ? 'Photograph added.' : 'Photograph added. Its size could not be read; check that the link opens.',
        bad: false,
      });
    } catch (failure) {
      setMessage({ text: failureText(failure), bad: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={panel} aria-labelledby="g-link-title">
      <div className={panelHead}>
        <h2 id="g-link-title" className={panelTitle}>
          Add a photograph by link
        </h2>
      </div>
      <form className="flex max-w-2xl flex-col gap-5 px-5 py-5" onSubmit={(event) => void add(event)}>
        <Field
          id="g-link-url"
          label="Image link"
          hint="An https:// link to the image file, or a path on this site such as /images/site-visit.webp."
        >
          <input
            id="g-link-url"
            className={input}
            required
            maxLength={1024}
            pattern="(https://|/(?!/)).+"
            placeholder="https://"
            inputMode="url"
            value={url}
            disabled={saving}
            onChange={(event) => setUrl(event.target.value)}
            aria-describedby="g-link-url-hint"
          />
        </Field>
        <Field id="g-link-alt" label="Alt text" hint="What the photograph shows, for people who cannot see it.">
          <textarea
            id="g-link-alt"
            className={`${textarea} min-h-16`}
            required
            minLength={3}
            maxLength={ALT_TEXT_MAX}
            value={alt}
            disabled={saving}
            onChange={(event) => setAlt(event.target.value)}
            aria-describedby="g-link-alt-hint"
          />
        </Field>
        <Field id="g-link-caption" label="Caption" optional>
          <input
            id="g-link-caption"
            className={input}
            maxLength={CAPTION_MAX}
            value={caption}
            disabled={saving}
            onChange={(event) => setCaption(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <button className={btnSmallOrange} type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add photograph'}
          </button>
          {message ? (
            <p
              className={`text-[0.813rem] ${message.bad ? 'text-msg-bad' : 'text-msg-ok'}`}
              role={message.bad ? 'alert' : 'status'}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
