'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { genUploader } from 'uploadthing/client';
import type { UploadRouter } from '@/lib/storage/uploadthing';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from '@/lib/documentCategories';
import { fileFacts, formatFileSize } from '../../../../components/documents';
import { ApiFailure, api, authHeaders } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
  filterInput,
  formatNumber,
  muted,
  panel,
  useResource,
  withQuery,
  type Page,
} from '../../kit';
import {
  Field,
  FormSection,
  SaveBar,
  changedFields,
  checkbox,
  checkboxRow,
  fieldLabel,
  input,
  orNull,
  selectInput,
  textarea,
  useUnsavedChanges,
} from '../../form-kit';
import { linkText, type AdminProject } from '../projects/project-list';
import { publicationText, type AdminDocument } from './document-list';

/**
 * Add and edit a document — `POST /api/admin/documents`, `PATCH` and `DELETE
 * /api/admin/documents/[id]` (delete is admin-only).
 *
 * The file is a PDF uploaded straight from the browser to UploadThing (the
 * `document` route, authorised by the console's bearer token, as tour models
 * are: docs/decisions.md §2.2) and registered by its key afterwards; or a link
 * to a file hosted elsewhere. Replacing an uploaded file, or switching it for
 * a link, deletes the stored upload. An update sends only what changed.
 */

type FileSource = 'upload' | 'link';

interface PickedProject {
  id: string;
  title: string;
}

interface FormState {
  title: string;
  slug: string;
  description: string;
  category: DocumentCategory;
  project: PickedProject | null;
  source: FileSource;
  fileUrl: string;
  published: boolean;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  description: '',
  category: 'company_profile',
  project: null,
  source: 'upload',
  fileUrl: '',
  published: false,
};

const CATEGORY_HINTS: Record<DocumentCategory, string> = {
  company_profile: 'Who CoBuilt is: the document most visitors look for.',
  capability_statement: 'What CoBuilt can deliver, for partners and procurement teams.',
  brochure: 'Marketing brochures for a development or a service.',
  project_profile: 'One development in detail. Choose the project so it is listed on that project’s page too.',
  policy: 'A policy CoBuilt publishes, such as health and safety. Listed with the site’s own policies.',
  other: 'Anything else worth a download.',
};

function formFrom(document: AdminDocument): FormState {
  return {
    title: document.title,
    slug: document.slug,
    description: document.description ?? '',
    category: document.category,
    project: document.project ? { id: document.project.id, title: document.project.title } : null,
    source: document.fileKey ? 'upload' : 'link',
    fileUrl: document.fileKey ? '' : document.fileUrl,
    published: document.published,
  };
}

/** Everything but the file, which is sent only when it changes. */
function fieldsFrom(form: FormState) {
  return {
    title: form.title.trim(),
    // A slug cannot be cleared, only changed; blank on create derives one from the title.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    description: orNull(form.description),
    category: form.category,
    projectId: form.project?.id ?? null,
    published: form.published,
  };
}

function isPdf(file: File): boolean {
  return file.name.split('.').pop()?.toLowerCase() === 'pdf';
}

const { uploadFiles } = genUploader<UploadRouter>({ package: 'uploadthing' });

/** Uploads the PDF to UploadThing and returns the stored file's key. */
async function uploadToStorage(file: File, onProgress: (fraction: number) => void): Promise<string> {
  try {
    const [uploaded] = await uploadFiles('document', {
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

type Stage = { step: 'idle' } | { step: 'uploading'; fraction: number } | { step: 'saving' };

export default function DocumentEditor({ documentId }: { documentId: string | null }) {
  const document = useResource<AdminDocument>(documentId ? `/api/admin/documents/${documentId}` : null);
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Document added.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (documentId && !document.data) {
    return (
      <>
        <PageHeader label="Downloads" title="Edit document" />
        <section className={panel} aria-busy={document.loading}>
          <StateBox loading={document.loading} error={document.error} onRetry={document.reload} />
        </section>
      </>
    );
  }

  return (
    <DocumentForm
      key={document.data?.updatedAt ?? 'new'}
      document={document.data}
      notice={notice}
      onSaved={(saved) => {
        setNotice('Changes saved. The Resources page follows within a minute.');
        document.setData(() => saved);
      }}
    />
  );
}

function DocumentForm({
  document,
  notice,
  onSaved,
}: {
  document: AdminDocument | null;
  notice: string | null;
  onSaved: (saved: AdminDocument) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = document ? formFrom(document) : EMPTY;
  const [form, setForm] = useState<FormState>(loaded);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>({ step: 'idle' });
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(
    notice ? { text: notice, bad: false } : null,
  );

  const busy = stage.step !== 'idle';
  const dirty = JSON.stringify(form) !== JSON.stringify(loaded) || file !== null;
  useUnsavedChanges(dirty && !busy);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  /**
   * The file to send, if it changed: a fresh upload's key, or a link that
   * differs from the stored one. Uploads happen here, before the save.
   */
  async function fileChange(): Promise<{ fileKey: string } | { fileUrl: string } | null> {
    const wasUpload = Boolean(document?.fileKey);

    if (form.source === 'upload') {
      if (!file) {
        if (document && wasUpload) return null;
        throw new ApiFailure(0, 'Choose a PDF to upload.');
      }
      if (!isPdf(file)) throw new ApiFailure(0, 'The document must be a PDF.');
      setStage({ step: 'uploading', fraction: 0 });
      return { fileKey: await uploadToStorage(file, (fraction) => setStage({ step: 'uploading', fraction })) };
    }

    const url = form.fileUrl.trim();
    if (!url.startsWith('https://')) throw new ApiFailure(0, 'The link must start with https://.');
    if (document && !wasUpload && url === document.fileUrl) return null;
    return { fileUrl: url };
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    try {
      const next = fieldsFrom(form);
      const fileFields = await fileChange();
      setStage({ step: 'saving' });

      if (!document) {
        const created = await api<AdminDocument>('/api/admin/documents', {
          method: 'POST',
          json: { ...next, ...fileFields },
        });
        router.replace(`/admin/downloads/${created.id}?created=1`);
        return;
      }

      const changes = { ...changedFields(fieldsFrom(loaded), next), ...fileFields };
      if (Object.keys(changes).length === 0) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        setStage({ step: 'idle' });
        return;
      }

      const saved = await api<AdminDocument>(`/api/admin/documents/${document.id}`, {
        method: 'PATCH',
        json: changes,
      });
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setStage({ step: 'idle' });
    }
  }

  async function remove(): Promise<void> {
    if (!document) return;
    const stored = document.fileKey ? ' Its uploaded file is deleted too.' : '';
    if (
      !window.confirm(
        `Delete “${document.title}”? It leaves the Resources page and its download count is lost.${stored} This cannot be undone — unpublishing keeps it for later.`,
      )
    ) {
      return;
    }

    setStage({ step: 'saving' });
    try {
      await api<void>(`/api/admin/documents/${document.id}`, { method: 'DELETE' });
      router.replace('/admin/downloads');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setStage({ step: 'idle' });
    }
  }

  // DELETE is admin-only even though editors hold downloads:write.
  const canDelete = user.role === 'admin' && can('downloads:write');
  const replacing = Boolean(document) && (form.source !== loaded.source || (form.source === 'upload' && file !== null));

  const submitLabel =
    stage.step === 'uploading'
      ? `Uploading ${Math.round(stage.fraction * 100)}%`
      : stage.step === 'saving'
        ? 'Saving…'
        : document
          ? 'Save changes'
          : 'Add document';

  return (
    <>
      <PageHeader label="Downloads" title={document ? document.title : 'Add a document'}>
        {document ? (
          <>
            {publicationText(document)} · {formatNumber(document.downloadCount)} {document.downloadCount === 1 ? 'download' : 'downloads'}
            {' · '}
            <a className={linkText} href={document.fileUrl} target="_blank" rel="noopener noreferrer">
              Open the file<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        ) : (
          'Saved as a draft unless you publish it below. It is added at the end of its group.'
        )}
      </PageHeader>

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Document">
          <Field id="d-title" label="Title" hint="As visitors see it, such as “Company profile 2026”.">
            <input
              id="d-title"
              className={input}
              required
              minLength={2}
              maxLength={255}
              value={form.title}
              disabled={busy}
              onChange={(event) => set('title', event.target.value)}
              aria-describedby="d-title-hint"
            />
          </Field>
          <Field id="d-category" label="Category" hint={CATEGORY_HINTS[form.category]}>
            <select
              id="d-category"
              className={selectInput}
              value={form.category}
              disabled={busy}
              onChange={(event) => set('category', event.target.value as DocumentCategory)}
              aria-describedby="d-category-hint"
            >
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="d-description"
            label="Description"
            optional
            hint={`One or two sentences under the title. ${form.description.length} of 600 characters.`}
          >
            <textarea
              id="d-description"
              className={`${textarea} min-h-20`}
              maxLength={600}
              value={form.description}
              disabled={busy}
              onChange={(event) => set('description', event.target.value)}
              aria-describedby="d-description-hint"
            />
          </Field>
          <Field
            id="d-slug"
            label="Short name"
            optional={!document}
            hint={
              document
                ? 'A stable name for this document, used in the console and the API.'
                : 'Made from the title if left blank.'
            }
          >
            <input
              id="d-slug"
              className={input}
              required={Boolean(document)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              disabled={busy}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="d-slug-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="File">
          <fieldset className="flex flex-col gap-1">
            <legend className={`${fieldLabel} mb-1.5`}>Source</legend>
            {(
              [
                { source: 'upload', label: 'Upload a PDF', note: 'Stored with CoBuilt, up to 32 MB.' },
                { source: 'link', label: 'Link to a file', note: 'A file already hosted elsewhere, by its https link.' },
              ] as const
            ).map((option) => (
              <label key={option.source} className={`${checkboxRow} items-start py-2`}>
                <input
                  className={`${checkbox} mt-0.5`}
                  type="radio"
                  name="d-source"
                  checked={form.source === option.source}
                  disabled={busy}
                  onChange={() => set('source', option.source)}
                />
                <span>
                  {option.label}
                  <span className={`block ${muted}`}>{option.note}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {document ? (
            <p className={muted}>
              Current file: {fileFacts(document.fileType, document.fileSizeBytes)},{' '}
              {document.fileKey ? 'uploaded' : 'linked'}.
              {replacing && document.fileKey ? ' Saving replaces it, and the uploaded file is deleted from storage.' : ''}
            </p>
          ) : null}

          {form.source === 'upload' ? (
            <div className="flex flex-col gap-1.75">
              <label className={fieldLabel} htmlFor="d-file">
                {document?.fileKey ? 'Replace the PDF' : 'PDF'}
                {document?.fileKey ? (
                  <span className="font-normal tracking-normal normal-case text-zinc-500"> (optional)</span>
                ) : null}
              </label>
              <input
                id="d-file"
                className="min-h-target text-[0.875rem] text-ink file:mr-3 file:min-h-target file:cursor-pointer file:border file:border-zinc-300 file:bg-white file:px-4 file:text-[0.688rem] file:font-semibold file:tracking-[0.14em] file:text-ink file:uppercase"
                type="file"
                accept=".pdf,application/pdf"
                required={!document?.fileKey}
                disabled={busy}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setMessage(null);
                }}
              />
              {file ? <p className={muted}>{formatFileSize(file.size) ?? '0 KB'}</p> : null}
            </div>
          ) : (
            <Field id="d-url" label="Link to the file" hint="Must start with https://. Its type is read from the link; its size is not shown.">
              <input
                id="d-url"
                className={input}
                type="url"
                inputMode="url"
                placeholder="https://"
                required
                maxLength={512}
                value={form.fileUrl}
                disabled={busy}
                onChange={(event) => set('fileUrl', event.target.value)}
                aria-describedby="d-url-hint"
              />
            </Field>
          )}

          {stage.step === 'uploading' ? (
            <progress
              className="h-1.5 w-full appearance-none overflow-hidden bg-line [&::-moz-progress-bar]:bg-orange [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-orange"
              max={1}
              value={stage.fraction}
              aria-label="Upload progress"
            />
          ) : null}
        </FormSection>

        <FormSection title="Project">
          <ProjectPicker value={form.project} disabled={busy} onChange={(project) => set('project', project)} />
        </FormSection>

        <FormSection title="Publication">
          <fieldset className="flex flex-col gap-1">
            <legend className={`${fieldLabel} mb-1.5`}>Publication</legend>
            {[
              { published: false, label: 'Draft', note: 'Not on the public site, and its download link does not work.' },
              {
                published: true,
                label: 'Published',
                note: 'On the Resources page, and its project’s page, within a minute of saving.',
              },
            ].map((option) => (
              <label key={option.label} className={`${checkboxRow} items-start py-2.5`}>
                <input
                  className={`${checkbox} mt-0.5`}
                  type="radio"
                  name="d-publication"
                  checked={form.published === option.published}
                  disabled={busy}
                  onChange={() => set('published', option.published)}
                />
                <span>
                  {option.label}
                  <span className={`block ${muted}`}>{option.note}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </FormSection>

        <SaveBar message={message}>
          <button className={btnSmallOrange} type="submit" disabled={busy || (Boolean(document) && !dirty)}>
            {submitLabel}
          </button>
          {document && dirty ? (
            <button
              className={btnSmall}
              type="button"
              disabled={busy}
              onClick={() => {
                setForm(loaded);
                setFile(null);
              }}
            >
              Discard changes
            </button>
          ) : null}
          {!document ? (
            <Link className={btnSmall} href="/admin/downloads">
              Cancel
            </Link>
          ) : null}
          {document && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={busy} onClick={() => void remove()}>
              Delete document
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}

/**
 * The project a document belongs to, if any. Candidates come from the
 * projects list, drafts included; a document on a draft project stays off the
 * site until the project is published.
 */
function ProjectPicker({
  value,
  disabled,
  onChange,
}: {
  value: PickedProject | null;
  disabled: boolean;
  onChange: (value: PickedProject | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const candidates = useResource<Page<AdminProject>>(
    withQuery('/api/projects', { includeUnpublished: 'true', q, pageSize: 50 }),
  );
  const results = candidates.data?.results ?? [];
  // The chosen project stays selectable when a search leaves it out.
  const options = value && !results.some((project) => project.id === value.id) ? [value, ...results] : results;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="d-project-search">
          Search projects
        </label>
        <input
          id="d-project-search"
          className={`${filterInput} min-w-0 flex-1`}
          type="search"
          placeholder="Search projects"
          maxLength={200}
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            // Inside the document form, Enter would submit it.
            if (event.key === 'Enter') {
              event.preventDefault();
              setQ(search.trim());
            }
          }}
        />
        <button className={btnSmall} type="button" disabled={disabled} onClick={() => setQ(search.trim())}>
          Search
        </button>
      </div>

      <Field
        id="d-project"
        label="Belongs to"
        optional
        hint="A document attached to a project is also listed on that project’s page."
      >
        <select
          id="d-project"
          className={selectInput}
          value={value?.id ?? ''}
          disabled={disabled}
          onChange={(event) => {
            const chosen = options.find((project) => project.id === event.target.value);
            onChange(chosen ? { id: chosen.id, title: chosen.title } : null);
          }}
          aria-describedby="d-project-hint"
        >
          <option value="">No project</option>
          {options.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
              {'isPublished' in project && !project.isPublished ? ' (draft)' : ''}
            </option>
          ))}
        </select>
      </Field>

      {candidates.error ? (
        <StateBox loading={false} error={candidates.error} onRetry={candidates.reload} />
      ) : q && results.length === 0 && !candidates.loading ? (
        <p className={muted}>No projects match “{q}”.</p>
      ) : null}
    </div>
  );
}
