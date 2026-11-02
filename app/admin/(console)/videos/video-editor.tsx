'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminVideo } from '@/lib/repositories/videos';
import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABEL,
  formatDuration,
  parseDuration,
  type VideoCategory,
} from '@/lib/videos';
import { youtubeVideoId, youtubeWatchUrl } from '@/lib/youtube';
import { media } from '../../../../components/ui';
import { cssUrl } from '../../../projects/[slug]/project-shared';
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
import { publishedText } from './video-list';

/**
 * Add and edit a video — `POST /api/admin/videos`, `PATCH` and `DELETE
 * /api/admin/videos/[id]` (delete is admin-only). An update sends only the
 * fields that changed.
 *
 * The YouTube link is checked as it is typed with the same rule the API
 * applies (src/lib/youtube.ts): one video on YouTube's own hosts. Nothing is
 * fetched from YouTube to preview it — the still shown is the one the public
 * page will show.
 */

/** The linked project, as the picker holds it. */
interface PickedProject {
  id: string;
  title: string;
  isPublished: boolean;
  featuredImageUrl: string | null;
}

interface FormState {
  youtubeUrl: string;
  title: string;
  slug: string;
  description: string;
  category: VideoCategory | '';
  project: PickedProject | null;
  thumbnailUrl: string;
  duration: string;
  recordedOn: string;
  featured: boolean;
  published: boolean;
}

const EMPTY: FormState = {
  youtubeUrl: '',
  title: '',
  slug: '',
  description: '',
  category: '',
  project: null,
  thumbnailUrl: '',
  duration: '',
  recordedOn: '',
  featured: false,
  published: false,
};

function formFrom(video: AdminVideo): FormState {
  return {
    youtubeUrl: video.watchUrl,
    title: video.title,
    slug: video.slug,
    description: video.description,
    category: video.category,
    project: video.project
      ? {
          id: video.project.id,
          title: video.project.title,
          isPublished: video.project.isPublished,
          featuredImageUrl: video.project.featuredImageUrl,
        }
      : null,
    thumbnailUrl: video.thumbnailUrl ?? '',
    duration: formatDuration(video.durationSeconds) ?? '',
    recordedOn: video.recordedOn ?? '',
    featured: video.featured,
    published: video.published,
  };
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function payloadFrom(form: FormState) {
  const id = youtubeVideoId(form.youtubeUrl);
  if (!id) {
    throw new ApiFailure(0, 'The YouTube link must point to one video, such as https://www.youtube.com/watch?v=…');
  }
  if (!form.category) throw new ApiFailure(0, 'Choose a category.');
  const durationSeconds = parseDuration(form.duration);
  if (durationSeconds === undefined) {
    throw new ApiFailure(0, 'Give the length as minutes and seconds, such as 6:42, or leave it blank.');
  }
  const thumbnailUrl = orNull(form.thumbnailUrl);
  if (thumbnailUrl && !isHttps(thumbnailUrl)) {
    throw new ApiFailure(0, 'The thumbnail must be an https:// image address, or blank.');
  }

  return {
    // The canonical form, so pasting a youtu.be link to the same film is not a change.
    youtubeUrl: youtubeWatchUrl(id),
    title: form.title.trim(),
    // A slug cannot be cleared, only changed; blank on create derives one from the title.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    description: form.description.trim(),
    category: form.category,
    projectId: form.project?.id ?? null,
    thumbnailUrl,
    durationSeconds,
    recordedOn: orNull(form.recordedOn),
    featured: form.featured,
    published: form.published,
  };
}

export default function VideoEditor({ videoId }: { videoId: string | null }) {
  const video = useResource<AdminVideo>(videoId ? `/api/admin/videos/${videoId}` : null);
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Video added.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (videoId && !video.data) {
    return (
      <>
        <PageHeader label="Videos" title="Edit video" />
        <section className={panel} aria-busy={video.loading}>
          <StateBox loading={video.loading} error={video.error} onRetry={video.reload} />
        </section>
      </>
    );
  }

  return (
    <VideoForm
      key={video.data ? video.data.updatedAt : 'new'}
      video={video.data}
      notice={notice}
      onSaved={(saved) => {
        setNotice('Changes saved. The public pages follow within a minute.');
        video.setData(() => saved);
      }}
    />
  );
}

function VideoForm({
  video,
  notice,
  onSaved,
}: {
  video: AdminVideo | null;
  notice: string | null;
  onSaved: (saved: AdminVideo) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = video ? formFrom(video) : EMPTY;
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

    try {
      const next = payloadFrom(form);
      setSaving(true);

      if (!video) {
        const created = await api<AdminVideo>('/api/admin/videos', { method: 'POST', json: next });
        router.replace(`/admin/videos/${created.id}?created=1`);
        return;
      }

      const changes = changedFields(payloadFrom(loaded), next);
      if (Object.keys(changes).length === 0) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        setSaving(false);
        return;
      }

      onSaved(await api<AdminVideo>(`/api/admin/videos/${video.id}`, { method: 'PATCH', json: changes }));
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!video) return;
    if (
      !window.confirm(
        `Delete “${video.title}” from the library? Its page leaves the public site; the film itself stays on YouTube. This cannot be undone — unpublishing keeps it for later.`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await api<void>(`/api/admin/videos/${video.id}`, { method: 'DELETE' });
      router.replace('/admin/videos');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  // DELETE is admin-only even though editors hold videos:write.
  const canDelete = user.role === 'admin' && can('videos:write');

  const linkInvalid = form.youtubeUrl.trim() !== '' && !youtubeVideoId(form.youtubeUrl);
  const durationInvalid = parseDuration(form.duration) === undefined;
  const thumbnail = form.thumbnailUrl.trim();
  const thumbnailInvalid = thumbnail !== '' && !isHttps(thumbnail);
  // What the public card will show: the editor's still, else the project's photograph.
  const preview = (!thumbnailInvalid && thumbnail) || form.project?.featuredImageUrl || null;

  return (
    <>
      <PageHeader label="Videos" title={video ? video.title : 'Add a video'}>
        {video ? (
          <>
            {publishedText(video)}
            {video.published ? (
              <>
                {' · '}
                <a className={linkText} href={`/videos/${video.slug}`} target="_blank" rel="noopener noreferrer">
                  View on site
                </a>
              </>
            ) : null}
          </>
        ) : (
          'Saved as a draft unless you publish it below. It is added at the end of the library.'
        )}
      </PageHeader>

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Video">
          <Field
            id="v-url"
            label="YouTube link"
            hint="A watch, youtu.be or Shorts link to one video on the CoBuilt channel. It plays from youtube-nocookie.com, only once a visitor presses play. Add captions on YouTube before publishing: the site promises WCAG 2.2 AA."
          >
            <input
              id="v-url"
              className={input}
              type="url"
              inputMode="url"
              required
              placeholder="https://www.youtube.com/watch?v=…"
              maxLength={512}
              value={form.youtubeUrl}
              onChange={(event) => set('youtubeUrl', event.target.value)}
              aria-describedby="v-url-hint"
              aria-invalid={linkInvalid || undefined}
            />
          </Field>
          {linkInvalid ? (
            <p className="text-[0.813rem] text-msg-bad" role="alert">
              This is not a link to one YouTube video.
            </p>
          ) : null}
          <Field id="v-title" label="Title" hint="On the card, the player and the page; read out by screen readers.">
            <input
              id="v-title"
              className={input}
              required
              minLength={2}
              maxLength={255}
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              aria-describedby="v-title-hint"
            />
          </Field>
          <Field
            id="v-slug"
            label="Web address"
            optional={!video}
            hint={
              video
                ? 'The page lives at /videos/ followed by this. Changing it breaks links already shared to the old address.'
                : 'Made from the title if left blank.'
            }
          >
            <input
              id="v-slug"
              className={input}
              required={Boolean(video)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="v-slug-hint"
            />
          </Field>
          <Field id="v-category" label="Category">
            <select
              id="v-category"
              className={selectInput}
              required
              value={form.category}
              onChange={(event) => set('category', event.target.value as VideoCategory | '')}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {VIDEO_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {VIDEO_CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="v-description" label="Description" optional hint="Under the player. Separate paragraphs with a blank line.">
            <textarea
              id="v-description"
              className={`${textarea} leading-[1.7]`}
              rows={6}
              maxLength={5000}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              aria-describedby="v-description-hint"
            />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="v-duration" label="Length" optional hint="Minutes and seconds, such as 6:42.">
              <input
                id="v-duration"
                className={input}
                inputMode="numeric"
                placeholder="6:42"
                maxLength={9}
                value={form.duration}
                onChange={(event) => set('duration', event.target.value)}
                aria-describedby="v-duration-hint"
                aria-invalid={durationInvalid || undefined}
              />
            </Field>
            <Field id="v-recorded" label="Recorded" optional hint="Sorts the leadership page’s latest interviews.">
              <input
                id="v-recorded"
                className={input}
                type="date"
                value={form.recordedOn}
                onChange={(event) => set('recordedOn', event.target.value)}
                aria-describedby="v-recorded-hint"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Project">
          <ProjectPicker value={form.project} onChange={(value) => set('project', value)} />
        </FormSection>

        <FormSection title="Thumbnail">
          <Field
            id="v-thumbnail"
            label="Thumbnail image address"
            optional
            hint="An https:// image, 16:9. Left blank, the card shows the project’s photograph, or a house still. YouTube’s own thumbnail is never used: it would contact Google before a visitor chose to watch."
          >
            <input
              id="v-thumbnail"
              className={input}
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={512}
              value={form.thumbnailUrl}
              onChange={(event) => set('thumbnailUrl', event.target.value)}
              aria-describedby="v-thumbnail-hint"
              aria-invalid={thumbnailInvalid || undefined}
            />
          </Field>
          {thumbnailInvalid ? (
            <p className="text-[0.813rem] text-msg-bad" role="alert">
              The thumbnail must be an https:// address.
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className={fieldLabel}>Shown on the card</p>
            {preview ? (
              <div
                className={`${media} aspect-video w-full max-w-80 border border-zinc-300`}
                style={{ backgroundImage: cssUrl(preview) }}
                role="img"
                aria-label={`Card still for ${form.title || 'this video'}`}
              />
            ) : (
              <p className={muted}>The house still, until a thumbnail or a project with a photograph is set.</p>
            )}
          </div>
        </FormSection>

        <FormSection title="Publication">
          <label className={`${checkboxRow} items-start py-1`}>
            <input
              className={`${checkbox} mt-0.5`}
              type="checkbox"
              checked={form.featured}
              onChange={(event) => set('featured', event.target.checked)}
            />
            <span>
              Featured
              <span className={`block ${muted}`}>
                The first featured, published video in the library&rsquo;s order leads the Videos page.
              </span>
            </span>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className={`${fieldLabel} mb-1.5`}>Publication</legend>
            {[
              { published: false, label: 'Draft', note: 'Not on the public site.' },
              {
                published: true,
                label: 'Published',
                note: 'In the video library, on its own page and on its project’s page, within a minute of saving.',
              },
            ].map((option) => (
              <label key={option.label} className={`${checkboxRow} items-start py-2.5`}>
                <input
                  className={`${checkbox} mt-0.5`}
                  type="radio"
                  name="v-publication"
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
          <button className={btnSmallOrange} type="submit" disabled={saving || (Boolean(video) && !dirty)}>
            {saving ? 'Saving…' : video ? 'Save changes' : 'Add video'}
          </button>
          {video && dirty ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
          {!video ? (
            <Link className={btnSmall} href="/admin/videos">
              Cancel
            </Link>
          ) : null}
          {video && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={saving} onClick={() => void remove()}>
              Delete video
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}

/**
 * The one project the film documents. Candidates come from the projects list,
 * drafts included: a draft can be linked now and is linked on the public site
 * once it is published.
 */
function ProjectPicker({
  value,
  onChange,
}: {
  value: PickedProject | null;
  onChange: (value: PickedProject | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const candidates = useResource<Page<AdminProject>>(
    withQuery('/api/projects', { includeUnpublished: 'true', q, pageSize: 6 }),
  );

  return (
    <div className="flex flex-col gap-5">
      {value ? (
        <div className="flex flex-col gap-2 border border-zinc-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-[0.875rem] font-semibold break-words text-ink">{value.title}</p>
            <p className={muted}>
              {value.isPublished
                ? 'Linked from the video, and the video is listed on its project page.'
                : 'Not published — linked once the project is.'}
            </p>
          </div>
          <button className={btnSmall} type="button" onClick={() => onChange(null)}>
            Unlink<span className="sr-only"> {value.title}</span>
          </button>
        </div>
      ) : (
        <p className={muted}>
          No project. Link the development the film documents, and it is listed on that project&rsquo;s
          page and filterable by project in the library.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <p className={fieldLabel} id="v-project-choose">
          {value ? 'Choose another project' : 'Choose a project'}
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="v-project-search">
            Search projects
          </label>
          <input
            id="v-project-search"
            className={`${filterInput} min-w-0 flex-1`}
            type="search"
            placeholder="Search projects"
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Inside the video form, Enter would submit it.
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
        {!candidates.data || candidates.data.results.length === 0 ? (
          <StateBox
            loading={candidates.loading}
            error={candidates.error}
            onRetry={candidates.reload}
            empty={q ? 'No projects match.' : 'There are no projects yet.'}
          />
        ) : (
          <ul className="flex flex-col border border-zinc-300" aria-labelledby="v-project-choose">
            {candidates.data.results.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0"
              >
                <span className="min-w-0 text-[0.875rem] break-words text-ink">
                  {project.title}
                  {!project.isPublished ? <span className={`block ${muted}`}>Not published</span> : null}
                </span>
                <button
                  className={btnSmall}
                  type="button"
                  disabled={value?.id === project.id}
                  onClick={() =>
                    onChange({
                      id: project.id,
                      title: project.title,
                      isPublished: project.isPublished,
                      featuredImageUrl: project.featuredImageUrl,
                    })
                  }
                >
                  {value?.id === project.id ? 'Linked' : 'Link'}
                  <span className="sr-only"> {project.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
