'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiFailure, api } from '../../auth-client';
import { useSession } from '../console-shell';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
  formatNumber,
  muted,
  panel,
  useResource,
} from '../../kit';
import {
  CmsNotice,
  Field,
  FormSection,
  PublicationField,
  SaveBar,
  changedFields,
  checkbox,
  checkboxRow,
  fieldLabel,
  firstBadUrl,
  input,
  lines,
  orNull,
  publicationFrom,
  publishedAtFor,
  selectInput,
  textarea,
  useUnsavedChanges,
  type Publication,
} from '../../form-kit';
import { STATUS_LABELS, linkText, publicationText, type AdminProject } from './project-list';

/**
 * Create and edit a project — `POST /api/projects`, `PUT` and `DELETE
 * /api/projects/[id]`, with pickers from `GET /api/admin/taxonomy`.
 *
 * An update sends only the fields that changed. Any investor figure in an
 * update withdraws legal approval (repositories/projects.ts), so an untouched
 * figure must never be resent, and an edit that does touch one is confirmed.
 *
 * Gallery albums are not attached here: they come from the CMS, and there is
 * no endpoint listing them.
 */

interface Option {
  id: string;
  name: string;
}

interface Taxonomy {
  projectTypes: Option[];
  locations: Option[];
  sectors: Option[];
  services: Option[];
  tags: Option[];
}

interface FormState {
  title: string;
  slug: string;
  status: AdminProject['status'];
  description: string;
  longDescription: string;
  projectTypeId: string;
  locationId: string;
  sectorId: string;
  serviceIds: string[];
  tagIds: string[];
  featuredImageUrl: string;
  brochureUrl: string;
  timelineVideoUrls: string;
  passportEnabled: boolean;
  passportStartDate: string;
  passportCompletionTarget: string;
  investmentAmount: string;
  expectedRoi: string;
  investorHighlights: string;
  metaTitle: string;
  metaDescription: string;
  openGraphImageUrl: string;
  canonicalUrl: string;
  publication: Publication;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  status: 'ongoing',
  description: '',
  longDescription: '',
  projectTypeId: '',
  locationId: '',
  sectorId: '',
  serviceIds: [],
  tagIds: [],
  featuredImageUrl: '',
  brochureUrl: '',
  timelineVideoUrls: '',
  passportEnabled: false,
  passportStartDate: '',
  passportCompletionTarget: '',
  investmentAmount: '',
  expectedRoi: '',
  investorHighlights: '',
  metaTitle: '',
  metaDescription: '',
  openGraphImageUrl: '',
  canonicalUrl: '',
  publication: { mode: 'draft', at: '' },
};

/**
 * Highlights are jsonb and may arrive as a list, an object or one string
 * (project-detail.tsx reads all three). They are edited as "Label: value"
 * lines and saved as an object, the shape the write API accepts.
 */
function highlightsText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(String).join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([label, item]) => `${label}: ${String(item)}`)
      .join('\n');
  }
  return '';
}

function formFrom(project: AdminProject): FormState {
  return {
    title: project.title,
    slug: project.slug,
    status: project.status,
    description: project.description ?? '',
    longDescription: project.longDescription ?? '',
    projectTypeId: project.projectTypeId ?? '',
    locationId: project.locationId ?? '',
    sectorId: project.sectorId ?? '',
    serviceIds: project.serviceIds,
    tagIds: project.tagIds,
    featuredImageUrl: project.featuredImageUrl ?? '',
    brochureUrl: project.brochureUrl ?? '',
    timelineVideoUrls: project.timelineVideoUrls.join('\n'),
    passportEnabled: project.passport.enabled,
    passportStartDate: project.passport.startDate ?? '',
    passportCompletionTarget: project.passport.completionTarget ?? '',
    investmentAmount: project.investor.investmentAmount === null ? '' : String(project.investor.investmentAmount),
    expectedRoi: project.investor.expectedRoi === null ? '' : String(project.investor.expectedRoi),
    investorHighlights: highlightsText(project.investor.highlights),
    metaTitle: project.seo.metaTitle ?? '',
    metaDescription: project.seo.metaDescription ?? '',
    openGraphImageUrl: project.seo.openGraphImageUrl ?? '',
    canonicalUrl: project.seo.canonicalUrl ?? '',
    publication: publicationFrom(project.publishedAt),
  };
}

class FormError extends Error {}

function parseNumber(value: string, label: string): number | null {
  const cleaned = value.replace(/[,\s₦%]/g, '');
  if (!cleaned) return null;
  const number = Number(cleaned);
  if (!Number.isFinite(number)) throw new FormError(`${label} must be a number.`);
  return number;
}

function parseHighlights(text: string): Record<string, string> | null {
  const entries = lines(text).map((line) => {
    const colon = line.indexOf(':');
    if (colon <= 0 || !line.slice(colon + 1).trim()) {
      throw new FormError(`Write each investor highlight as “Label: value” — “${line}” has no label.`);
    }
    return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()] as const;
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/**
 * The write payload. Investor figures are compared as typed text against the
 * form as loaded, so a value that only round-trips differently (a number
 * stored in highlights, say) is never resent — resending withdraws approval.
 */
function payloadFrom(form: FormState, loaded: FormState, originalPublishedAt: string | null) {
  const videos = lines(form.timelineVideoUrls);
  const badVideo = firstBadUrl(videos);
  if (badVideo) throw new FormError(`“${badVideo}” is not a web address. Timeline videos need one per line.`);

  return {
    title: form.title.trim(),
    // A slug cannot be cleared, only changed; blank on create derives one from the title.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    status: form.status,
    description: orNull(form.description),
    longDescription: orNull(form.longDescription),
    projectTypeId: form.projectTypeId || null,
    locationId: form.locationId || null,
    sectorId: form.sectorId || null,
    serviceIds: form.serviceIds,
    tagIds: form.tagIds,
    featuredImageUrl: orNull(form.featuredImageUrl),
    brochureUrl: orNull(form.brochureUrl),
    timelineVideoUrls: videos,
    passportEnabled: form.passportEnabled,
    passportStartDate: form.passportStartDate || null,
    passportCompletionTarget: form.passportCompletionTarget || null,
    investmentAmount:
      form.investmentAmount === loaded.investmentAmount
        ? undefined
        : parseNumber(form.investmentAmount, 'Investment amount'),
    expectedRoi:
      form.expectedRoi === loaded.expectedRoi ? undefined : parseNumber(form.expectedRoi, 'Expected ROI'),
    investorHighlights:
      form.investorHighlights === loaded.investorHighlights
        ? undefined
        : parseHighlights(form.investorHighlights),
    metaTitle: orNull(form.metaTitle),
    metaDescription: orNull(form.metaDescription),
    openGraphImageUrl: orNull(form.openGraphImageUrl),
    canonicalUrl: orNull(form.canonicalUrl),
    publishedAt: publishedAtFor(form.publication, originalPublishedAt),
  };
}

const INVESTOR_FIELDS = ['investmentAmount', 'expectedRoi', 'investorHighlights'] as const;

export default function ProjectEditor({ projectId }: { projectId: string | null }) {
  const project = useResource<AdminProject>(
    projectId ? `/api/projects/${projectId}?includeUnpublished=true` : null,
  );
  const taxonomy = useResource<Taxonomy>('/api/admin/taxonomy');
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  // Arriving from "New project" after the create succeeded.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Project created.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (projectId && !project.data) {
    return (
      <>
        <PageHeader label="Projects" title="Edit project" />
        <section className={panel} aria-busy={project.loading}>
          <StateBox loading={project.loading} error={project.error} onRetry={project.reload} />
        </section>
      </>
    );
  }

  return (
    <ProjectForm
      // Remounted after a save so the "as loaded" baseline is the saved project.
      key={project.data?.updatedAt ?? 'new'}
      project={project.data}
      taxonomy={taxonomy.data}
      taxonomyError={taxonomy.error}
      notice={notice}
      onSaved={(saved) => {
        setNotice('Changes saved.');
        project.setData(() => saved);
      }}
    />
  );
}

function ProjectForm({
  project,
  taxonomy,
  taxonomyError,
  notice,
  onSaved,
}: {
  project: AdminProject | null;
  taxonomy: Taxonomy | null;
  taxonomyError: string | null;
  notice: string | null;
  onSaved: (saved: AdminProject) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = project ? formFrom(project) : EMPTY;
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

  function toggle(key: 'serviceIds' | 'tagIds', id: string, on: boolean): void {
    set(key, on ? [...form[key], id] : form[key].filter((existing) => existing !== id));
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    try {
      const next = payloadFrom(form, loaded, project?.publishedAt ?? null);

      if (!project) {
        setSaving(true);
        const created = await api<AdminProject>('/api/projects', { method: 'POST', json: next });
        router.replace(`/admin/projects/${created.id}?created=1`);
        return;
      }

      const changes = changedFields(payloadFrom(loaded, loaded, project.publishedAt), next);
      if (Object.keys(changes).length === 0) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        return;
      }

      const touchesInvestor = INVESTOR_FIELDS.some((field) => field in changes);
      if (
        touchesInvestor &&
        project.investor.approved &&
        !window.confirm(
          'Changing the investor figures withdraws their legal approval, and they leave the public site until approved again. Save anyway?',
        )
      ) {
        return;
      }

      setSaving(true);
      const saved = await api<AdminProject>(`/api/projects/${project.id}`, { method: 'PUT', json: changes });
      onSaved(saved);
    } catch (failure) {
      setMessage({
        text:
          failure instanceof FormError || failure instanceof ApiFailure
            ? failure.message
            : 'No connection to the server.',
        bad: true,
      });
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!project) return;
    if (!window.confirm(`Delete “${project.title}”? It leaves the public site at once.`)) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${project.id}`, { method: 'DELETE' });
      router.replace('/admin/projects');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  const canDelete = user.role === 'admin' && can('projects:delete');
  const highlightsHint = project?.investor.approved
    ? 'Approved and shown publicly. Changing any investor figure withdraws the approval.'
    : 'Withheld from the public site until approved under Investor approval.';

  return (
    <>
      <PageHeader label="Projects" title={project ? project.title : 'New project'}>
        {project ? (
          <>
            {publicationText(project)} · {STATUS_LABELS[project.status]}
            {project.isPublished ? (
              <>
                {' · '}
                <a className={linkText} href={`/projects/${project.slug}`} target="_blank" rel="noopener noreferrer">
                  View on site
                </a>
              </>
            ) : null}
            {can('passport:write') ? (
              <>
                {' · '}
                <Link className={linkText} href={`/admin/projects/${project.id}/passport`}>
                  Passport milestones
                </Link>
              </>
            ) : null}
          </>
        ) : (
          'Saved as a draft unless you publish it below. The address is made from the title unless you set one.'
        )}
      </PageHeader>

      {project ? <CmsNotice cms={project.cms} /> : null}

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Basics">
          <Field id="p-title" label="Title">
            <input
              id="p-title"
              className={input}
              required
              minLength={3}
              maxLength={255}
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>
          <Field
            id="p-slug"
            label="Web address"
            optional={!project}
            hint={project ? 'Changing it breaks links already shared to the old address.' : 'Lowercase words joined by hyphens.'}
          >
            <input
              id="p-slug"
              className={input}
              required={Boolean(project)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="p-slug-hint"
            />
          </Field>
          <Field id="p-status" label="Status">
            <select
              id="p-status"
              className={selectInput}
              value={form.status}
              onChange={(event) => set('status', event.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="p-description" label="Summary" optional hint="Shown on project cards and in search results.">
            <textarea
              id="p-description"
              className={`${textarea} min-h-20`}
              maxLength={2000}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              aria-describedby="p-description-hint"
            />
          </Field>
          <Field id="p-long" label="Full description" optional hint="Separate paragraphs with a blank line.">
            <textarea
              id="p-long"
              className={`${textarea} min-h-56`}
              maxLength={50_000}
              value={form.longDescription}
              onChange={(event) => set('longDescription', event.target.value)}
              aria-describedby="p-long-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Classification">
          {taxonomyError ? (
            <p className="text-[0.813rem] text-msg-bad" role="alert">
              The lists below could not be loaded: {taxonomyError}
            </p>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-3">
            <TaxonomySelect id="p-type" label="Project type" value={form.projectTypeId} options={taxonomy?.projectTypes} onChange={(v) => set('projectTypeId', v)} />
            <TaxonomySelect id="p-location" label="Location" value={form.locationId} options={taxonomy?.locations} onChange={(v) => set('locationId', v)} />
            <TaxonomySelect id="p-sector" label="Sector" value={form.sectorId} options={taxonomy?.sectors} onChange={(v) => set('sectorId', v)} />
          </div>
          <CheckboxGroup
            label="Services"
            options={taxonomy?.services}
            selected={form.serviceIds}
            onToggle={(id, on) => toggle('serviceIds', id, on)}
          />
          <CheckboxGroup
            label="Tags"
            options={taxonomy?.tags}
            selected={form.tagIds}
            onToggle={(id, on) => toggle('tagIds', id, on)}
          />
        </FormSection>

        <FormSection title="Media">
          <UrlField id="p-image" label="Featured image" value={form.featuredImageUrl} onChange={(v) => set('featuredImageUrl', v)} />
          <UrlField id="p-brochure" label="Brochure (PDF)" value={form.brochureUrl} onChange={(v) => set('brochureUrl', v)} />
          <Field id="p-videos" label="Timeline videos" optional hint="One web address per line, in the order they should play. Gallery albums are attached in the CMS.">
            <textarea
              id="p-videos"
              className={`${textarea} min-h-20 font-mono text-[0.813rem]`}
              value={form.timelineVideoUrls}
              onChange={(event) => set('timelineVideoUrls', event.target.value)}
              aria-describedby="p-videos-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Project Passport™">
          <label className={checkboxRow}>
            <input
              className={checkbox}
              type="checkbox"
              checked={form.passportEnabled}
              onChange={(event) => set('passportEnabled', event.target.checked)}
            />
            Show the Passport on the public site
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="p-start" label="Start date" optional>
              <input id="p-start" className={input} type="date" value={form.passportStartDate} onChange={(event) => set('passportStartDate', event.target.value)} />
            </Field>
            <Field id="p-target" label="Target completion" optional>
              <input id="p-target" className={input} type="date" value={form.passportCompletionTarget} onChange={(event) => set('passportCompletionTarget', event.target.value)} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Investor figures">
          <p className={muted}>{highlightsHint}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="p-amount"
              label="Investment amount (₦)"
              optional
              hint={form.investmentAmount ? formatNumber(Number(form.investmentAmount.replace(/[,\s₦]/g, '')) || null) : undefined}
            >
              <input
                id="p-amount"
                className={`${input} tabular-nums`}
                inputMode="decimal"
                value={form.investmentAmount}
                onChange={(event) => set('investmentAmount', event.target.value)}
                aria-describedby="p-amount-hint"
              />
            </Field>
            <Field id="p-roi" label="Expected ROI (%)" optional>
              <input
                id="p-roi"
                className={`${input} tabular-nums`}
                inputMode="decimal"
                value={form.expectedRoi}
                onChange={(event) => set('expectedRoi', event.target.value)}
              />
            </Field>
          </div>
          <Field id="p-highlights" label="Highlights" optional hint="One per line, as “Label: value” — for example “Tenure: Freehold”.">
            <textarea
              id="p-highlights"
              className={`${textarea} min-h-24`}
              value={form.investorHighlights}
              onChange={(event) => set('investorHighlights', event.target.value)}
              aria-describedby="p-highlights-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Search and sharing">
          <Field id="p-meta-title" label="Page title" optional hint="Defaults to the project title.">
            <input id="p-meta-title" className={input} maxLength={255} value={form.metaTitle} onChange={(event) => set('metaTitle', event.target.value)} aria-describedby="p-meta-title-hint" />
          </Field>
          <Field id="p-meta-description" label="Search description" optional hint={`${form.metaDescription.length} of 160 characters.`}>
            <textarea
              id="p-meta-description"
              className={`${textarea} min-h-20`}
              maxLength={160}
              value={form.metaDescription}
              onChange={(event) => set('metaDescription', event.target.value)}
              aria-describedby="p-meta-description-hint"
            />
          </Field>
          <UrlField id="p-og" label="Sharing image" value={form.openGraphImageUrl} onChange={(v) => set('openGraphImageUrl', v)} />
          <UrlField id="p-canonical" label="Canonical address" value={form.canonicalUrl} onChange={(v) => set('canonicalUrl', v)} />
        </FormSection>

        <FormSection title="Publication">
          <PublicationField
            idPrefix="p"
            value={form.publication}
            original={project?.publishedAt ?? null}
            onChange={(next) => set('publication', next)}
          />
        </FormSection>

        <SaveBar message={message}>
          <button className={btnSmallOrange} type="submit" disabled={saving || (Boolean(project) && !dirty)}>
            {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
          </button>
          {project && dirty ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
          {!project ? (
            <Link className={btnSmall} href="/admin/projects">
              Cancel
            </Link>
          ) : null}
          {project && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={saving} onClick={() => void remove()}>
              Delete project
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}

function TaxonomySelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[] | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} optional>
      <select
        id={id}
        className={selectInput}
        value={value}
        disabled={!options}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{options ? 'None' : 'Loading…'}</option>
        {options?.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CheckboxGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Option[] | undefined;
  selected: string[];
  onToggle: (id: string, on: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className={`${fieldLabel} mb-1`}>{label}</legend>
      {!options ? (
        <p className={muted}>Loading…</p>
      ) : options.length === 0 ? (
        <p className={muted}>None set up yet.</p>
      ) : (
        <div className="grid gap-x-5 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.id} className={checkboxRow}>
              <input
                className={checkbox}
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={(event) => onToggle(option.id, event.target.checked)}
              />
              {option.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function UrlField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} optional>
      <input
        id={id}
        className={input}
        type="url"
        inputMode="url"
        placeholder="https://"
        maxLength={512}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
