'use client';

import { useEffect, useRef, useState } from 'react';
import { genUploader } from 'uploadthing/client';
import type { TourType } from '@/types/models';
import type { UploadRouter } from '@/lib/storage/uploadthing';
import type { serializeProjectForAdmin, serializeTourForAdmin } from '@/lib/serializers';
import { field, fieldLabel, input } from '../../../../components/sections';
import { ApiFailure, api, authHeaders } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
  filterInput,
  filterSelect,
  formatDateTime,
  formatNumber,
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
 * 3D tours per project — `GET /api/projects/[idOrSlug]/tours` (drafts
 * included for staff), `POST /api/admin/tours`, and `PATCH` and `DELETE`
 * on `/api/admin/tours/[tourId]`.
 *
 * A Three.js model goes straight from the browser to UploadThing, authorised
 * by the console's bearer token, and is registered afterwards
 * (docs/decisions.md §2.2). Replacing a model on edit takes the same route.
 *
 * A tour's format is fixed once it exists; only an admin can delete.
 */

type AdminProject = ReturnType<typeof serializeProjectForAdmin>;
type AdminTour = ReturnType<typeof serializeTourForAdmin>;

const TYPE_LABELS: Record<TourType, string> = {
  threejs_model: 'Three.js model',
  matterport_embed: 'Matterport',
  custom_viewer: 'Custom viewer',
};

const TYPE_HINTS: Record<TourType, string> = {
  threejs_model: 'Upload a .glb, .gltf or zipped model. It is stored with CoBuilt.',
  matterport_embed: 'Paste the Matterport share link, or its embed code, or both.',
  custom_viewer: 'Link to a hosted viewer page. Only https links open on the site.',
};

const MODEL_EXTENSIONS = ['glb', 'gltf', 'zip'];

function isModelFile(file: File): boolean {
  return MODEL_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() ?? '');
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** A trimmed value, or null for an empty field so an edit can clear it. */
function cleared(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

type TourUpdate = {
  tourName: string;
  modelKey: string | undefined;
  tourUrl: string | null | undefined;
  embedCode: string | null | undefined;
  thumbnailUrl: string | null;
  description: string | null;
  featured: boolean;
  published: boolean;
};

/**
 * Only the fields that differ from the stored tour, so the audit log records
 * what was actually changed rather than every field on the form.
 */
function changedFields(tour: AdminTour, next: TourUpdate): Partial<TourUpdate> {
  const current: Record<keyof TourUpdate, unknown> = {
    tourName: tour.name,
    modelKey: undefined,
    tourUrl: tour.tourUrl,
    embedCode: tour.embedCode,
    thumbnailUrl: tour.thumbnailUrl,
    description: tour.description,
    featured: tour.featured,
    published: tour.published,
  };
  const changes: Partial<Record<keyof TourUpdate, unknown>> = {};
  for (const field of Object.keys(next) as Array<keyof TourUpdate>) {
    if (next[field] !== undefined && next[field] !== current[field]) changes[field] = next[field];
  }
  return changes as Partial<TourUpdate>;
}

function failureText(failure: unknown): string {
  return failure instanceof ApiFailure ? failure.message : 'No connection to the server.';
}

const { uploadFiles } = genUploader<UploadRouter>({ package: 'uploadthing' });

/** Uploads the model to UploadThing and returns the stored file's key. */
async function uploadToStorage(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<string> {
  try {
    const [uploaded] = await uploadFiles('tourModel', {
      files: [file],
      headers: await authHeaders(),
      onUploadProgress: ({ progress }) => onProgress(progress / 100),
    });
    if (!uploaded) throw new Error('No file was returned.');
    return uploaded.key;
  } catch (failure) {
    if (failure instanceof ApiFailure) throw failure;
    // UploadThing errors carry the middleware's own message (role, size, type).
    const message = failure instanceof Error ? failure.message : '';
    throw new ApiFailure(0, message || 'The upload failed. Check your connection, then try again.');
  }
}

export default function TourManager() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [chosenId, setChosenId] = useState<string | null>(null);

  const projectList = useResource<Page<AdminProject>>(
    withQuery('/api/projects', { includeUnpublished: 'true', q, pageSize: 50 }),
  );
  const projects = projectList.data?.results ?? [];
  // Falls back to the first match, so a search always lands on a project.
  const project = projects.find((p) => p.id === chosenId) ?? projects[0] ?? null;

  return (
    <>
      <PageHeader label="3D tours" title="Virtual tours">
        Tours appear on the project page, featured first. A draft tour is kept here but not shown
        publicly.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(search.trim());
          }}
        >
          <label className="sr-only" htmlFor="tours-search">
            Search projects
          </label>
          <input
            id="tours-search"
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

        {projects.length > 0 ? (
          <>
            <label className="sr-only" htmlFor="tours-project">
              Project
            </label>
            <select
              id="tours-project"
              className={`${filterSelect} max-w-full`}
              value={project?.id ?? ''}
              onChange={(event) => setChosenId(event.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.isPublished ? '' : ' (draft)'}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      {projectList.data?.pagination.hasNextPage ? (
        <p className={`-mt-2 mb-5 ${muted}`}>
          Showing the first {projects.length} of {formatNumber(projectList.data.pagination.total)}{' '}
          projects. Search to find one not listed.
        </p>
      ) : null}

      {project ? (
        // Keyed so the tour list and the half-filled form reset with the project.
        <ProjectTours key={project.id} project={project} />
      ) : (
        <section className={panel} aria-busy={projectList.loading}>
          <StateBox
            loading={projectList.loading}
            error={projectList.error}
            onRetry={projectList.reload}
            empty={q ? 'No projects match.' : 'There are no projects yet.'}
          />
        </section>
      )}
    </>
  );
}

function ProjectTours({ project }: { project: AdminProject }) {
  const { user, can } = useSession();
  const list = useResource<{ projectId: string; results: AdminTour[] }>(
    `/api/projects/${project.id}/tours`,
  );
  // DELETE is admin-only even though editors hold tours:write.
  const canDelete = user.role === 'admin' && can('tours:write');
  const [editing, setEditing] = useState<AdminTour | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <section className={panel} aria-busy={list.loading}>
        <div className={panelHead}>
          <h2 className={panelTitle}>Tours on {project.title}</h2>
          {list.data ? <p className={muted}>{list.data.results.length} in all</p> : null}
        </div>

        {!list.data || list.data.results.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="This project has no tours yet. Add one below."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse">
              <thead>
                <tr>
                  <th className={th} scope="col">Tour</th>
                  <th className={th} scope="col">Status</th>
                  <th className={th} scope="col">Size</th>
                  <th className={th} scope="col">Views</th>
                  <th className={th} scope="col">Added</th>
                  <th className={th} scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data.results.map((tour) => (
                  <TourRow
                    key={tour.id}
                    tour={tour}
                    isEditing={editing?.id === tour.id}
                    canDelete={canDelete}
                    onEdit={() => setEditing(tour)}
                    onDeleted={() => {
                      if (editing?.id === tour.id) setEditing(null);
                      list.setData((current) => ({
                        ...current,
                        results: current.results.filter((r) => r.id !== tour.id),
                      }));
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!canDelete && list.data && list.data.results.length > 0 ? (
          <p className={`border-t border-line px-5 py-3.5 ${muted}`}>
            Only an administrator can delete a tour.
          </p>
        ) : null}
      </section>

      {/* Keyed so switching between tours, or back to adding, starts from that tour's values. */}
      <TourForm
        key={editing?.id ?? 'new'}
        projectId={project.id}
        tour={editing}
        onSaved={() => {
          setEditing(null);
          // Reloaded rather than patched in place: featuring a tour reorders the list.
          list.reload();
        }}
        onCancel={() => setEditing(null)}
      />
    </div>
  );
}

function TourRow({
  tour,
  isEditing,
  canDelete,
  onEdit,
  onDeleted,
}: {
  tour: AdminTour;
  isEditing: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function remove(): Promise<void> {
    const stored = tour.type === 'threejs_model' ? ' Its uploaded model file is deleted too.' : '';
    if (!window.confirm(`Delete “${tour.name}”?${stored} This cannot be undone.`)) return;

    setDeleting(true);
    setError('');
    try {
      await api<void>(`/api/admin/tours/${tour.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (failure) {
      setError(failureText(failure));
      setDeleting(false);
    }
  }

  // Only an https link is offered, matching what the public viewer will frame.
  const opensAt = tour.tourUrl?.startsWith('https://') ? tour.tourUrl : null;
  const failed = tour.processingStatus === 'failed';

  return (
    <tr className={isEditing ? 'bg-zinc-100' : undefined}>
      <td className={`${td} max-w-sm`}>
        <span className="font-semibold text-ink">{tour.name}</span>
        <span className={`block ${muted}`}>
          {TYPE_LABELS[tour.type]}
          {opensAt ? (
            <>
              {' · '}
              <a
                className="text-rust underline underline-offset-2 hover:text-rust-hover"
                href={opensAt}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tour.type === 'threejs_model' ? 'Model file' : 'Open'}
              </a>
            </>
          ) : null}
        </span>
        {tour.description ? (
          <span className={`mt-1 line-clamp-2 block ${muted}`}>{tour.description}</span>
        ) : null}
      </td>
      <td className={td}>
        <span className={tour.published ? 'text-msg-ok' : 'text-zinc-700'}>
          {tour.published ? 'Published' : 'Draft'}
        </span>
        {tour.featured ? <span className={`block ${muted}`}>Featured</span> : null}
        {tour.processingStatus !== 'ready' ? (
          <span className={`block text-[0.75rem] capitalize ${failed ? 'text-msg-bad' : 'text-zinc-600'}`}>
            {failed && tour.processingError ? `Failed: ${tour.processingError}` : tour.processingStatus}
          </span>
        ) : null}
      </td>
      <td className={`${td} whitespace-nowrap tabular-nums`}>{formatBytes(tour.fileSizeBytes)}</td>
      <td className={`${td} tabular-nums`}>{formatNumber(tour.viewCount)}</td>
      <td className={`${td} whitespace-nowrap`}>{formatDateTime(tour.uploadedAt)}</td>
      <td className={`${td} text-right`}>
        <div className="flex justify-end gap-2">
          <button
            className={btnSmall}
            type="button"
            disabled={deleting || isEditing}
            onClick={onEdit}
            aria-label={`Edit ${tour.name}`}
          >
            {isEditing ? 'Editing' : 'Edit'}
          </button>
          {canDelete ? (
            <button className={btnSmallDanger} type="button" disabled={deleting} onClick={() => void remove()}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-1.5 text-[0.75rem] text-msg-bad" role="alert">
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

type Stage =
  | { step: 'idle' }
  | { step: 'uploading'; fraction: number }
  | { step: 'registering' };

/** Adds a tour, or edits `tour` when one is given. */
function TourForm({
  projectId,
  tour,
  onSaved,
  onCancel,
}: {
  projectId: string;
  tour: AdminTour | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<TourType>(tour?.type ?? 'threejs_model');
  const [name, setName] = useState(tour?.name ?? '');
  const [file, setFile] = useState<File | null>(null);
  // A Three.js tour's URL is its stored file, not something entered here.
  const [tourUrl, setTourUrl] = useState(tour?.type === 'threejs_model' ? '' : (tour?.tourUrl ?? ''));
  const [embedCode, setEmbedCode] = useState(tour?.embedCode ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(tour?.thumbnailUrl ?? '');
  const [description, setDescription] = useState(tour?.description ?? '');
  const [featured, setFeatured] = useState(tour?.featured ?? false);
  const [published, setPublished] = useState(tour?.published ?? true);
  const [stage, setStage] = useState<Stage>({ step: 'idle' });
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  // Bumped after a successful add so the file input, which cannot be
  // controlled, is cleared along with the other fields.
  const [formKey, setFormKey] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const busy = stage.step !== 'idle';

  // Opening an edit moves focus to the form, which also scrolls it into view
  // from a row further up the page.
  useEffect(() => {
    if (tour) nameRef.current?.focus();
  }, [tour]);

  function reset(): void {
    setName('');
    setFile(null);
    setTourUrl('');
    setEmbedCode('');
    setThumbnailUrl('');
    setDescription('');
    setFeatured(false);
    setPublished(true);
    setFormKey((n) => n + 1);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    let modelKey: string | undefined;

    try {
      // A new tour of this format needs a file; an edit keeps its file unless one is chosen.
      if (type === 'threejs_model' && (file || !tour)) {
        if (!file) throw new ApiFailure(0, 'Choose a model file to upload.');
        if (!isModelFile(file)) throw new ApiFailure(0, 'The model must be a .glb, .gltf or .zip file.');

        setStage({ step: 'uploading', fraction: 0 });
        modelKey = await uploadToStorage(file, (fraction) =>
          setStage({ step: 'uploading', fraction }),
        );
      }

      setStage({ step: 'registering' });

      if (tour) {
        await api<AdminTour>(`/api/admin/tours/${tour.id}`, {
          method: 'PATCH',
          json: changedFields(tour, {
            tourName: name.trim(),
            modelKey,
            tourUrl: type === 'threejs_model' ? undefined : cleared(tourUrl),
            embedCode: type === 'matterport_embed' ? cleared(embedCode) : undefined,
            thumbnailUrl: cleared(thumbnailUrl),
            description: cleared(description),
            featured,
            published,
          }),
        });
        onSaved();
        return;
      }

      // Empty optional fields are left out: the API validates any URL it is given.
      const optional = (value: string) => cleared(value) ?? undefined;
      await api<AdminTour>('/api/admin/tours', {
        method: 'POST',
        json: {
          projectId,
          tourName: name.trim(),
          tourType: type,
          modelKey,
          tourUrl: type === 'threejs_model' ? undefined : optional(tourUrl),
          embedCode: type === 'matterport_embed' ? optional(embedCode) : undefined,
          thumbnailUrl: optional(thumbnailUrl),
          description: optional(description),
          featured,
          published,
        },
      });

      reset();
      setMessage({ text: `Added “${name.trim()}”.`, bad: false });
      onSaved();
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
        : tour
          ? 'Save changes'
          : 'Add tour';

  return (
    <section className={panel}>
      <div className={panelHead}>
        <h2 className={panelTitle}>{tour ? `Edit “${tour.name}”` : 'Add a tour'}</h2>
      </div>

      <form key={formKey} className="flex max-w-2xl flex-col gap-5 px-5 py-5" onSubmit={(event) => void submit(event)}>
        <div className={field}>
          <label className={fieldLabel} htmlFor="tour-name">
            Name
          </label>
          <input
            ref={nameRef}
            id="tour-name"
            className={input}
            required
            minLength={2}
            maxLength={255}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className={field}>
          <label className={fieldLabel} htmlFor="tour-type">
            Format
          </label>
          <select
            id="tour-type"
            className={`${input} select-chevron cursor-pointer pr-10`}
            value={type}
            // A different format is a different tour: the API fixes it at creation.
            disabled={busy || tour !== null}
            onChange={(event) => setType(event.target.value as TourType)}
            aria-describedby="tour-type-hint"
          >
            {(Object.keys(TYPE_LABELS) as TourType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <p id="tour-type-hint" className={muted}>
            {tour
              ? 'The format cannot be changed. To use another, add a new tour and delete this one.'
              : TYPE_HINTS[type]}
          </p>
        </div>

        {type === 'threejs_model' ? (
          <div className={field}>
            <label className={fieldLabel} htmlFor="tour-file">
              {tour ? 'Replace model file' : 'Model file'}
              {tour ? (
                <span className="font-normal tracking-normal normal-case text-zinc-500"> (optional)</span>
              ) : null}
            </label>
            <input
              id="tour-file"
              className="min-h-target text-[0.875rem] text-ink file:mr-3 file:min-h-target file:cursor-pointer file:border file:border-zinc-300 file:bg-white file:px-4 file:text-[0.688rem] file:font-semibold file:tracking-[0.14em] file:text-ink file:uppercase"
              type="file"
              accept=".glb,.gltf,.zip"
              required={!tour}
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              aria-describedby={tour ? 'tour-file-hint' : undefined}
            />
            {file ? <p className={muted}>{formatBytes(file.size)}</p> : null}
            {tour ? (
              <p id="tour-file-hint" className={muted}>
                Current file: {formatBytes(tour.fileSizeBytes)}. A new file replaces it, and the old one is
                deleted from storage.
              </p>
            ) : null}
          </div>
        ) : (
          <div className={field}>
            <label className={fieldLabel} htmlFor="tour-url">
              Tour link{' '}
              {type === 'matterport_embed' ? (
                <span className="font-normal tracking-normal normal-case text-zinc-500">(or embed code below)</span>
              ) : null}
            </label>
            <input
              id="tour-url"
              className={input}
              type="url"
              inputMode="url"
              placeholder="https://"
              required={type === 'custom_viewer' || !embedCode.trim()}
              maxLength={512}
              value={tourUrl}
              disabled={busy}
              onChange={(event) => setTourUrl(event.target.value)}
            />
          </div>
        )}

        {type === 'matterport_embed' ? (
          <div className={field}>
            <label className={fieldLabel} htmlFor="tour-embed">
              Embed code <span className="font-normal tracking-normal normal-case text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="tour-embed"
              className={`${input} min-h-24 py-2.5 font-mono text-[0.813rem]`}
              maxLength={10_000}
              value={embedCode}
              disabled={busy}
              onChange={(event) => setEmbedCode(event.target.value)}
              aria-describedby="tour-embed-hint"
            />
            <p id="tour-embed-hint" className={muted}>
              Kept on record but not rendered on the site; the share link is what visitors open.
            </p>
          </div>
        ) : null}

        <div className={field}>
          <label className={fieldLabel} htmlFor="tour-thumb">
            Thumbnail link <span className="font-normal tracking-normal normal-case text-zinc-500">(optional)</span>
          </label>
          <input
            id="tour-thumb"
            className={input}
            type="url"
            inputMode="url"
            placeholder="https://"
            maxLength={512}
            value={thumbnailUrl}
            disabled={busy}
            onChange={(event) => setThumbnailUrl(event.target.value)}
          />
        </div>

        <div className={field}>
          <label className={fieldLabel} htmlFor="tour-description">
            Description <span className="font-normal tracking-normal normal-case text-zinc-500">(optional)</span>
          </label>
          <textarea
            id="tour-description"
            className={`${input} min-h-24 py-2.5`}
            maxLength={5000}
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <fieldset className="flex flex-wrap gap-x-6">
          <legend className="sr-only">Visibility</legend>
          <label className="flex min-h-target cursor-pointer items-center gap-2.5 text-[0.875rem] text-ink">
            <input
              className="size-4 accent-orange"
              type="checkbox"
              checked={published}
              disabled={busy}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Published
          </label>
          <label className="flex min-h-target cursor-pointer items-center gap-2.5 text-[0.875rem] text-ink">
            <input
              className="size-4 accent-orange"
              type="checkbox"
              checked={featured}
              disabled={busy}
              onChange={(event) => setFeatured(event.target.checked)}
            />
            Featured
          </label>
        </fieldset>

        {stage.step === 'uploading' ? (
          <progress
            className="h-1.5 w-full appearance-none overflow-hidden bg-line [&::-moz-progress-bar]:bg-orange [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-orange"
            max={1}
            value={stage.fraction}
            aria-label="Upload progress"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button className={btnSmallOrange} type="submit" disabled={busy}>
            {submitLabel}
          </button>
          {tour ? (
            <button className={btnSmall} type="button" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
          ) : null}
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
