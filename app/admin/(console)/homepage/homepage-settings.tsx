'use client';

import { useState } from 'react';
import type { HomepageSettings as Settings, StatKey } from '@/lib/schemas/settings';
import { youtubeVideoId } from '@/lib/youtube';
import { ApiFailure, api } from '../../auth-client';
import { PageHeader, StateBox, btnSmall, btnSmallOrange, formatDateTime, panel, useResource } from '../../kit';
import {
  Field,
  FormSection,
  SaveBar,
  checkbox,
  checkboxRow,
  input,
  orNull,
  textarea,
  useUnsavedChanges,
} from '../../form-kit';
import { linkText } from '../projects/project-list';

/**
 * Homepage settings — `GET` and `PUT /api/admin/settings/homepage`, admin only
 * (`settings:write`).
 *
 * The landing page's hero copy, its featured YouTube video, overrides for the
 * stat band's figures, and switches for the optional news, leadership and video
 * bands. A blank field means "as built", so clearing one restores the copy in
 * app/home-page.tsx. The tagline is not here: it is fixed copy
 * (docs/design-handover.md §1). A save is audited, and the page shows it
 * within a minute.
 */

interface HomepageView {
  settings: Settings;
  computed: { completed: number; ongoing: number; locations: number };
  updatedAt: string | null;
  updatedBy: string | null;
  revalidated?: boolean;
}

interface StatForm {
  /** Blank: no override, the page shows the computed figure. */
  value: string;
  plus: boolean;
}

interface FormState {
  heroHeadline: string;
  heroSubheading: string;
  videoUrl: string;
  videoTitle: string;
  stats: Record<StatKey, StatForm>;
  sections: Settings['sections'];
}

const STATS: Array<{ key: StatKey; label: string }> = [
  { key: 'completed', label: 'Projects delivered' },
  { key: 'ongoing', label: 'Projects under development' },
  { key: 'units', label: 'Units developed' },
  { key: 'locations', label: 'Locations' },
];

const SECTIONS: Array<{ key: keyof Settings['sections']; label: string; hint: string }> = [
  { key: 'video', label: 'Project video', hint: 'Shown only when a video is set below.' },
  { key: 'leadership', label: 'Leadership spotlight', hint: 'The first three published profiles.' },
  { key: 'news', label: 'Latest news', hint: 'The three most recent published articles.' },
];

function formFrom(settings: Settings): FormState {
  const stat = (key: StatKey): StatForm => {
    const override = settings.stats[key];
    return override ? { value: String(override.value), plus: override.plus } : { value: '', plus: false };
  };

  return {
    heroHeadline: settings.heroHeadline ?? '',
    heroSubheading: settings.heroSubheading ?? '',
    videoUrl: settings.video?.url ?? '',
    videoTitle: settings.video?.title ?? '',
    stats: { completed: stat('completed'), ongoing: stat('ongoing'), units: stat('units'), locations: stat('locations') },
    sections: { ...settings.sections },
  };
}

function payloadFrom(form: FormState): Settings {
  const videoUrl = form.videoUrl.trim();
  if (videoUrl && !youtubeVideoId(videoUrl)) {
    throw new ApiFailure(0, 'The video must be a link to one YouTube video, such as https://www.youtube.com/watch?v=…');
  }
  if (videoUrl && form.videoTitle.trim().length < 3) {
    throw new ApiFailure(0, 'Give the video a title of at least three characters. It is what a screen reader announces.');
  }

  const stat = (key: StatKey) => {
    const { value, plus } = form.stats[key];
    return value.trim() === '' ? null : { value: Number(value), plus };
  };

  return {
    heroHeadline: orNull(form.heroHeadline),
    heroSubheading: orNull(form.heroSubheading),
    video: videoUrl ? { url: videoUrl, title: form.videoTitle.trim() } : null,
    stats: { completed: stat('completed'), ongoing: stat('ongoing'), units: stat('units'), locations: stat('locations') },
    sections: form.sections,
  };
}

export default function HomepageSettings() {
  const resource = useResource<HomepageView>('/api/admin/settings/homepage');
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  if (!resource.data) {
    return (
      <>
        <PageHeader label="Site" title="Homepage" />
        <section className={panel} aria-busy={resource.loading}>
          <StateBox loading={resource.loading} error={resource.error} onRetry={resource.reload} />
        </section>
      </>
    );
  }

  return (
    <SettingsForm
      key={resource.data.updatedAt ?? 'new'}
      view={resource.data}
      notice={notice}
      onSaved={(saved) => {
        setNotice(
          saved.revalidated
            ? 'Saved. The homepage shows the change now.'
            : 'Saved. The homepage shows the change within a minute.',
        );
        resource.setData(() => saved);
      }}
    />
  );
}

function SettingsForm({
  view,
  notice,
  onSaved,
}: {
  view: HomepageView;
  notice: string | null;
  onSaved: (saved: HomepageView) => void;
}) {
  const loaded = formFrom(view.settings);
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

  function setStat(key: StatKey, value: Partial<StatForm>): void {
    set('stats', { ...form.stats, [key]: { ...form.stats[key], ...value } });
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = payloadFrom(form);
      setSaving(true);
      const saved = await api<HomepageView>('/api/admin/settings/homepage', { method: 'PUT', json: payload });
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  const videoInvalid = form.videoUrl.trim() !== '' && !youtubeVideoId(form.videoUrl);
  const computed: Record<StatKey, number | null> = { ...view.computed, units: null };

  return (
    <>
      <PageHeader label="Site" title="Homepage">
        The landing page&rsquo;s hero copy, featured video, figures and optional sections. A blank field
        shows the page as built. Saved changes appear within a minute.{' '}
        <a className={linkText} href="/" target="_blank" rel="noopener noreferrer">
          Preview the homepage<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {view.updatedAt ? (
          <>
            {' · '}Last saved {formatDateTime(view.updatedAt)}
            {view.updatedBy ? ` by ${view.updatedBy}` : ''}
          </>
        ) : null}
      </PageHeader>

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Hero">
          <Field
            id="h-headline"
            label="Headline"
            optional
            hint={
              <>
                Wrap one phrase in asterisks to set it in the accent italic, as in “a home that feels like
                *coming home*”. {form.heroHeadline.length} of 160 characters. The tagline above it is fixed.
              </>
            }
          >
            <input
              id="h-headline"
              className={input}
              maxLength={160}
              placeholder="Every family deserves a home that feels like *coming home*."
              value={form.heroHeadline}
              onChange={(event) => set('heroHeadline', event.target.value)}
              aria-describedby="h-headline-hint"
            />
          </Field>
          <Field id="h-subheading" label="Subheading" optional hint={`${form.heroSubheading.length} of 320 characters.`}>
            <textarea
              id="h-subheading"
              className={`${textarea} min-h-20`}
              maxLength={320}
              placeholder="Residential, commercial and mixed-use developments across Nigeria, delivered on a published programme and documented at every milestone."
              value={form.heroSubheading}
              onChange={(event) => set('heroSubheading', event.target.value)}
              aria-describedby="h-subheading-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Figures">
          <p className="text-[0.875rem] leading-[1.7] text-zinc-600">
            Each figure is counted from published projects unless you set it here. A figure of 0 is not shown,
            and the band is left out when every figure is 0. Units have no record to count from, so they show
            only when set.
          </p>
          {STATS.map(({ key, label }) => (
            <div key={key} className="grid gap-x-5 gap-y-1 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
              <Field
                id={`s-${key}`}
                label={label}
                optional
                hint={
                  computed[key] === null
                    ? 'Not counted. Leave blank to hide.'
                    : `Counted now: ${computed[key]}. Leave blank to use the count.`
                }
              >
                <input
                  id={`s-${key}`}
                  className={input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1_000_000}
                  step={1}
                  value={form.stats[key].value}
                  onChange={(event) => setStat(key, { value: event.target.value })}
                  aria-describedby={`s-${key}-hint`}
                />
              </Field>
              <label className={`${checkboxRow} sm:mb-6`}>
                <input
                  className={checkbox}
                  type="checkbox"
                  checked={form.stats[key].plus}
                  disabled={form.stats[key].value.trim() === ''}
                  onChange={(event) => setStat(key, { plus: event.target.checked })}
                />
                Show with “+”
              </label>
            </div>
          ))}
        </FormSection>

        <FormSection title="Project video">
          <Field
            id="v-url"
            label="YouTube link"
            optional
            hint="A watch, youtu.be or Shorts link to one video. It plays from youtube-nocookie.com, only once a visitor presses play. Add captions on YouTube before featuring a video: the site promises WCAG 2.2 AA."
          >
            <input
              id="v-url"
              className={input}
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              maxLength={512}
              value={form.videoUrl}
              onChange={(event) => set('videoUrl', event.target.value)}
              aria-describedby="v-url-hint"
              aria-invalid={videoInvalid || undefined}
            />
          </Field>
          {videoInvalid ? (
            <p className="text-[0.813rem] text-msg-bad" role="alert">
              This is not a link to a YouTube video.
            </p>
          ) : null}
          <Field id="v-title" label="Video title" optional={!form.videoUrl.trim()} hint="Shown on the poster and read out by screen readers.">
            <input
              id="v-title"
              className={input}
              required={Boolean(form.videoUrl.trim())}
              minLength={3}
              maxLength={120}
              value={form.videoTitle}
              onChange={(event) => set('videoTitle', event.target.value)}
              aria-describedby="v-title-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Optional sections">
          <p className="text-[0.875rem] leading-[1.7] text-zinc-600">
            Each section is also left out by itself when it has nothing to show.
          </p>
          {SECTIONS.map(({ key, label, hint }) => (
            <label key={key} className={`${checkboxRow} items-start py-1`}>
              <input
                className={`${checkbox} mt-1`}
                type="checkbox"
                checked={form.sections[key]}
                onChange={(event) => set('sections', { ...form.sections, [key]: event.target.checked })}
              />
              <span>
                Show {label.toLowerCase()}
                <span className="block text-[0.813rem] text-zinc-600">{hint}</span>
              </span>
            </label>
          ))}
        </FormSection>

        <SaveBar message={message}>
          <button className={btnSmallOrange} type="submit" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {dirty ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}
