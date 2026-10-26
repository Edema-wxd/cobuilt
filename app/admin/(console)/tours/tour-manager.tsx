'use client';

import { useState } from 'react';
import type { TourType } from '@/types/models';
import type { serializeProjectForAdmin, serializeTourForAdmin } from '@/lib/serializers';
import { field, fieldLabel, input } from '../../../../components/sections';
import { ApiFailure, api } from '../../auth-client';
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
 * included for staff), `POST /api/admin/tours/presign`, `POST /api/admin/tours`
 * and `DELETE /api/admin/tours/[tourId]`.
 *
 * A Three.js model goes straight from the browser to object storage on the
 * presigned URL and is registered afterwards (docs/decisions.md §2.2), so the
 * bucket must allow a cross-origin PUT from the console's origin.
 *
 * There is no update endpoint yet: a tour is corrected by deleting it and
 * adding it again, and only an admin can delete.
 */

type AdminProject = ReturnType<typeof serializeProjectForAdmin>;
type AdminTour = ReturnType<typeof serializeTourForAdmin>;

interface PresignedUpload {
  uploadUrl: string;
  key: string;
}

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

/**
 * Browsers report an empty or generic type for model files, so the type the
 * upload is signed for is taken from the extension instead.
 */
const MODEL_TYPES: Record<string, string> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  zip: 'application/zip',
};

function modelContentType(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MODEL_TYPES[extension] ?? null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function failureText(failure: unknown): string {
  return failure instanceof ApiFailure ? failure.message : 'No connection to the server.';
}

/**
 * PUTs the file to storage. XHR rather than fetch because fetch reports no
 * upload progress, and a 50 MB model on a slow line needs to show it moving.
 */
function uploadToStorage(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new ApiFailure(request.status, `Storage refused the upload (${request.status}).`));
    // A CORS rejection from the bucket also lands here, with no status to show.
    request.onerror = () =>
      reject(new ApiFailure(0, 'The upload to storage failed. Check your connection, then try again.'));
    request.send(file);
  });
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
                  {canDelete ? (
                    <th className={th} scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {list.data.results.map((tour) => (
                  <TourRow
                    key={tour.id}
                    tour={tour}
                    canDelete={canDelete}
                    onDeleted={() =>
                      list.setData((current) => ({
                        ...current,
                        results: current.results.filter((r) => r.id !== tour.id),
                      }))
                    }
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

      <AddTourForm projectId={project.id} onAdded={list.reload} />
    </div>
  );
}

function TourRow({
  tour,
  canDelete,
  onDeleted,
}: {
  tour: AdminTour;
  canDelete: boolean;
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
    <tr>
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
      {canDelete ? (
        <td className={`${td} text-right`}>
          <button className={btnSmallDanger} type="button" disabled={deleting} onClick={() => void remove()}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          {error ? (
            <p className="mt-1.5 text-[0.75rem] text-msg-bad" role="alert">
              {error}
            </p>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}

type Stage =
  | { step: 'idle' }
  | { step: 'presigning' }
  | { step: 'uploading'; fraction: number }
  | { step: 'registering' };

function AddTourForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [type, setType] = useState<TourType>('threejs_model');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tourUrl, setTourUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [description, setDescription] = useState('');
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(true);
  const [stage, setStage] = useState<Stage>({ step: 'idle' });
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  // Bumped after a successful add so the file input, which cannot be
  // controlled, is cleared along with the other fields.
  const [formKey, setFormKey] = useState(0);

  const busy = stage.step !== 'idle';

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
      if (type === 'threejs_model') {
        if (!file) throw new ApiFailure(0, 'Choose a model file to upload.');
        const contentType = modelContentType(file);
        if (!contentType) throw new ApiFailure(0, 'The model must be a .glb, .gltf or .zip file.');

        setStage({ step: 'presigning' });
        const upload = await api<PresignedUpload>('/api/admin/tours/presign', {
          method: 'POST',
          json: { projectId, contentType, contentLength: file.size },
        });

        setStage({ step: 'uploading', fraction: 0 });
        await uploadToStorage(upload.uploadUrl, file, contentType, (fraction) =>
          setStage({ step: 'uploading', fraction }),
        );
        modelKey = upload.key;
      }

      setStage({ step: 'registering' });
      // Empty optional fields are left out: the API validates any URL it is given.
      const optional = (value: string) => (value.trim() ? value.trim() : undefined);
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
      onAdded();
    } catch (failure) {
      setMessage({ text: failureText(failure), bad: true });
    } finally {
      setStage({ step: 'idle' });
    }
  }

  const submitLabel =
    stage.step === 'presigning'
      ? 'Preparing upload…'
      : stage.step === 'uploading'
        ? `Uploading ${Math.round(stage.fraction * 100)}%`
        : stage.step === 'registering'
          ? 'Saving…'
          : 'Add tour';

  return (
    <section className={panel}>
      <div className={panelHead}>
        <h2 className={panelTitle}>Add a tour</h2>
      </div>

      <form key={formKey} className="flex max-w-2xl flex-col gap-5 px-5 py-5" onSubmit={(event) => void submit(event)}>
        <div className={field}>
          <label className={fieldLabel} htmlFor="tour-name">
            Name
          </label>
          <input
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
            disabled={busy}
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
            {TYPE_HINTS[type]}
          </p>
        </div>

        {type === 'threejs_model' ? (
          <div className={field}>
            <label className={fieldLabel} htmlFor="tour-file">
              Model file
            </label>
            <input
              id="tour-file"
              className="min-h-target text-[0.875rem] text-ink file:mr-3 file:min-h-target file:cursor-pointer file:border file:border-zinc-300 file:bg-white file:px-4 file:text-[0.688rem] file:font-semibold file:tracking-[0.14em] file:text-ink file:uppercase"
              type="file"
              accept=".glb,.gltf,.zip"
              required
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file ? <p className={muted}>{formatBytes(file.size)}</p> : null}
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
