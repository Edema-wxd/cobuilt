'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GALLERY_CATEGORIES, GALLERY_CATEGORY_LABEL, type GalleryCategory } from '@/lib/gallery';
import type { AdminGalleryAlbum, AdminGalleryAlbumDetail } from '@/lib/repositories/gallery';
import { ApiFailure, api } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
  filterInput,
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
import { albumStateText } from './gallery-list';
import ImageManager from './image-manager';

/**
 * Create and edit an album — `POST /api/admin/gallery`, `PATCH` and `DELETE
 * /api/admin/gallery/[id]` (delete is admin-only). An update sends only the
 * fields that changed.
 *
 * The album's photographs are managed below the form once it exists
 * (`./image-manager.tsx`): uploads with progress, alt text and captions,
 * order, cover and deletion. Each of those saves on its own.
 */

type Album = AdminGalleryAlbumDetail;

interface FormState {
  title: string;
  slug: string;
  description: string;
  category: GalleryCategory;
  projectId: string;
  published: boolean;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  description: '',
  category: 'completed_projects',
  projectId: '',
  published: false,
};

function formFrom(album: AdminGalleryAlbum): FormState {
  return {
    title: album.title,
    slug: album.slug,
    description: album.description ?? '',
    category: album.category,
    projectId: album.project?.id ?? '',
    published: album.published,
  };
}

function payloadFrom(form: FormState) {
  return {
    title: form.title.trim(),
    // A slug cannot be cleared, only changed; blank on create derives one from the title.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    description: orNull(form.description),
    category: form.category,
    projectId: form.projectId || null,
    published: form.published,
  };
}

export default function AlbumEditor({ albumId }: { albumId: string | null }) {
  const album = useResource<Album>(albumId ? `/api/admin/gallery/${albumId}` : null);
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped by a save of the form itself. A change made in the photographs
  // panel (a new cover, say) also updates the album, but must not remount the
  // form and throw away edits in progress there.
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Album created. Add its photographs below.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (albumId && !album.data) {
    return (
      <>
        <PageHeader label="Gallery" title="Edit album" />
        <section className={panel} aria-busy={album.loading}>
          <StateBox loading={album.loading} error={album.error} onRetry={album.reload} />
        </section>
      </>
    );
  }

  return (
    <>
      <AlbumForm
        key={formVersion}
        album={album.data}
        notice={notice}
        onSaved={(saved) => {
          setNotice('Changes saved. The gallery follows within a minute.');
          album.setData(() => saved);
          setFormVersion((n) => n + 1);
        }}
      />
      {album.data ? (
        <ImageManager
          album={album.data}
          onChange={(update) => album.setData((current) => update(current))}
        />
      ) : null}
    </>
  );
}

function AlbumForm({
  album,
  notice,
  onSaved,
}: {
  album: Album | null;
  notice: string | null;
  onSaved: (saved: Album) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = album ? formFrom(album) : EMPTY;
  const [form, setForm] = useState<FormState>(loaded);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(
    notice ? { text: notice, bad: false } : null,
  );

  const dirty = JSON.stringify(form) !== JSON.stringify(loaded);
  useUnsavedChanges(dirty && !saving);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const next = payloadFrom(form);

      if (!album) {
        const created = await api<AdminGalleryAlbum>('/api/admin/gallery', { method: 'POST', json: next });
        router.replace(`/admin/gallery/${created.id}?created=1`);
        return;
      }

      const changes = changedFields(payloadFrom(loaded), next);
      if (Object.keys(changes).length === 0) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        setSaving(false);
        return;
      }

      const saved = await api<Album>(`/api/admin/gallery/${album.id}`, { method: 'PATCH', json: changes });
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!album) return;
    const uploaded = album.images.filter((image) => image.fileKey).length;
    if (
      !window.confirm(
        `Delete “${album.title}” and its ${album.images.length} photographs?${
          uploaded > 0 ? ` The ${uploaded} uploaded files are deleted from storage too.` : ''
        } This cannot be undone — unpublishing keeps it for later.`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await api<void>(`/api/admin/gallery/${album.id}`, { method: 'DELETE' });
      router.replace('/admin/gallery');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  // DELETE is admin-only even though editors hold gallery:write.
  const canDelete = user.role === 'admin' && can('gallery:write');
  const live = album !== null && album.published && album.imageCount > 0;

  return (
    <>
      <PageHeader label="Gallery" title={album ? album.title : 'New album'}>
        {album ? (
          <>
            {albumStateText(album)}
            {live ? (
              <>
                {' · '}
                <a className={linkText} href={`/gallery/${album.slug}`} target="_blank" rel="noopener noreferrer">
                  View on site
                </a>
              </>
            ) : null}
          </>
        ) : (
          'Saved as a draft unless you publish it below. Photographs are added once the album exists.'
        )}
      </PageHeader>

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Album">
          <Field id="g-title" label="Title">
            <input
              id="g-title"
              className={input}
              required
              minLength={2}
              maxLength={255}
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>
          <Field
            id="g-slug"
            label="Web address"
            optional={!album}
            hint={
              album
                ? 'The album lives at /gallery/ followed by this. Changing it breaks links already shared to the old address.'
                : 'Made from the title if left blank.'
            }
          >
            <input
              id="g-slug"
              className={input}
              required={Boolean(album)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="g-slug-hint"
            />
          </Field>
          <Field id="g-category" label="Category" hint="The gallery’s filter this album is listed under.">
            <select
              id="g-category"
              className={selectInput}
              value={form.category}
              onChange={(event) => set('category', event.target.value as GalleryCategory)}
              aria-describedby="g-category-hint"
            >
              {GALLERY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {GALLERY_CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="g-description"
            label="Description"
            optional
            hint={`Under the title on the album’s page. ${form.description.length} of 2000 characters.`}
          >
            <textarea
              id="g-description"
              className={`${textarea} min-h-24`}
              maxLength={2000}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              aria-describedby="g-description-hint"
            />
          </Field>
          <ProjectField
            value={form.projectId}
            current={album?.project ?? null}
            onChange={(value) => set('projectId', value)}
          />
        </FormSection>

        <FormSection title="Publication">
          <fieldset className="flex flex-col gap-1">
            <legend className={`${fieldLabel} mb-1.5`}>Publication</legend>
            {[
              { published: false, label: 'Draft', note: 'Not on the public site.' },
              {
                published: true,
                label: 'Published',
                note: 'In the gallery, and on its project’s page, within a minute of saving — once it has a photograph.',
              },
            ].map((option) => (
              <label key={option.label} className={`${checkboxRow} items-start py-2.5`}>
                <input
                  className={`${checkbox} mt-0.5`}
                  type="radio"
                  name="g-publication"
                  checked={form.published === option.published}
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
          <button className={btnSmallOrange} type="submit" disabled={saving || (Boolean(album) && !dirty)}>
            {saving ? 'Saving…' : album ? 'Save changes' : 'Create album'}
          </button>
          {album && dirty ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
          {!album ? (
            <Link className={btnSmall} href="/admin/gallery">
              Cancel
            </Link>
          ) : null}
          {album && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={saving} onClick={() => void remove()}>
              Delete album
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}

/**
 * The project an album documents, chosen from the projects list (drafts
 * included). It files the album under that project in the gallery's project
 * filter, and lists it on the project's page.
 */
function ProjectField({
  value,
  current,
  onChange,
}: {
  value: string;
  current: { id: string; title: string } | null;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const candidates = useResource<Page<AdminProject>>(
    withQuery('/api/projects', { includeUnpublished: 'true', q, pageSize: 50 }),
  );
  const options = candidates.data?.results ?? [];
  // The saved project stays selectable even when a search leaves it out.
  const keepCurrent = current && current.id === value && !options.some((p) => p.id === current.id);

  return (
    <div className="flex flex-col gap-3">
      <Field id="g-project" label="Project" optional hint="Leave as “No project” for events, the team and branding.">
        <select
          id="g-project"
          className={selectInput}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby="g-project-hint"
        >
          <option value="">No project</option>
          {keepCurrent ? <option value={current.id}>{current.title}</option> : null}
          {options.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
              {project.isPublished ? '' : ' (not published)'}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="g-project-search">
          Search projects
        </label>
        <input
          id="g-project-search"
          className={`${filterInput} min-w-0 flex-1`}
          type="search"
          placeholder="Search projects"
          maxLength={200}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            // Inside the album form, Enter would submit it.
            if (event.key === 'Enter') {
              event.preventDefault();
              setQ(search.trim());
            }
          }}
        />
        <button className={btnSmall} type="button" onClick={() => setQ(search.trim())}>
          Search
        </button>
      </div>
      {candidates.error ? (
        <p className="text-[0.813rem] text-msg-bad" role="alert">
          {candidates.error}
        </p>
      ) : candidates.data?.pagination.hasNextPage ? (
        <p className={muted}>Showing the first {options.length} projects. Search to find one not listed.</p>
      ) : null}
    </div>
  );
}
