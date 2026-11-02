'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminService, AdminServiceProject, ServiceStep } from '@/lib/repositories/services';
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
  lines,
  orNull,
  textarea,
  useUnsavedChanges,
} from '../../form-kit';
import { linkText, type AdminProject } from '../projects/project-list';
import { publishedText } from './service-list';

/**
 * Create and edit a service — `POST /api/admin/services`, `PATCH` and `DELETE
 * /api/admin/services/[id]` (delete is admin-only), and `PUT
 * /api/admin/services/[id]/projects` for the projects on its page. One save
 * sends whichever of the two changed; an update sends only the fields that
 * changed.
 */

type Service = AdminService & { projects: AdminServiceProject[] };

/** A project on the page, as the picker holds it. */
interface PickedProject {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  caseStudy: boolean;
}

interface FormState {
  title: string;
  slug: string;
  summary: string;
  standfirst: string;
  body: string;
  covers: string;
  deliverables: string;
  suitedTo: string;
  process: ServiceStep[];
  benefits: ServiceStep[];
  informational: boolean;
  published: boolean;
  metaTitle: string;
  metaDescription: string;
  projects: PickedProject[];
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  summary: '',
  standfirst: '',
  body: '',
  covers: '',
  deliverables: '',
  suitedTo: '',
  process: [],
  benefits: [],
  informational: false,
  published: false,
  metaTitle: '',
  metaDescription: '',
  projects: [],
};

function formFrom(service: Service): FormState {
  return {
    title: service.title,
    slug: service.slug,
    summary: service.summary,
    standfirst: service.standfirst,
    body: service.body.join('\n\n'),
    covers: service.covers.join('\n'),
    deliverables: service.deliverables.join('\n'),
    suitedTo: service.suitedTo.join('\n'),
    process: service.process,
    benefits: service.benefits,
    informational: service.informational,
    published: service.published,
    metaTitle: service.seo.metaTitle ?? '',
    metaDescription: service.seo.metaDescription ?? '',
    projects: service.projects.map((project) => ({
      id: project.id,
      title: project.title,
      slug: project.slug,
      isPublished: project.isPublished,
      caseStudy: project.caseStudy,
    })),
  };
}

/** Steps with nothing typed in are dropped; a step needs a title to be shown. */
function stepsFrom(steps: ServiceStep[], label: string): ServiceStep[] {
  const kept = steps
    .map((step) => ({ title: step.title.trim(), body: step.body.trim() }))
    .filter((step) => step.title || step.body);
  if (kept.some((step) => !step.title)) {
    throw new ApiFailure(0, `Every ${label} needs a title.`);
  }
  return kept;
}

function payloadFrom(form: FormState) {
  return {
    title: form.title.trim(),
    // A slug cannot be cleared, only changed; blank on create derives one from the title.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    summary: form.summary.trim(),
    standfirst: form.standfirst.trim(),
    body: form.body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    covers: lines(form.covers),
    deliverables: lines(form.deliverables),
    suitedTo: lines(form.suitedTo),
    process: stepsFrom(form.process, 'process step'),
    benefits: stepsFrom(form.benefits, 'benefit'),
    informational: form.informational,
    published: form.published,
    metaTitle: orNull(form.metaTitle),
    metaDescription: orNull(form.metaDescription),
  };
}

function projectsPayload(projects: PickedProject[]) {
  return { projects: projects.map((project) => ({ projectId: project.id, caseStudy: project.caseStudy })) };
}

export default function ServiceEditor({ serviceId }: { serviceId: string | null }) {
  const service = useResource<Service>(serviceId ? `/api/admin/services/${serviceId}` : null);
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Service created.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (serviceId && !service.data) {
    return (
      <>
        <PageHeader label="Services" title="Edit service" />
        <section className={panel} aria-busy={service.loading}>
          <StateBox loading={service.loading} error={service.error} onRetry={service.reload} />
        </section>
      </>
    );
  }

  return (
    <ServiceForm
      key={service.data ? `${service.data.updatedAt}:${JSON.stringify(service.data.projects)}` : 'new'}
      service={service.data}
      notice={notice}
      onSaved={(saved) => {
        setNotice('Changes saved. The public page follows within a minute.');
        service.setData(() => saved);
      }}
    />
  );
}

function ServiceForm({
  service,
  notice,
  onSaved,
}: {
  service: Service | null;
  notice: string | null;
  onSaved: (saved: Service) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = service ? formFrom(service) : EMPTY;
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
      const projectsChanged =
        JSON.stringify(projectsPayload(form.projects)) !== JSON.stringify(projectsPayload(loaded.projects));
      setSaving(true);

      if (!service) {
        const created = await api<AdminService>('/api/admin/services', { method: 'POST', json: next });
        if (form.projects.length > 0) {
          await api(`/api/admin/services/${created.id}/projects`, {
            method: 'PUT',
            json: projectsPayload(form.projects),
          });
        }
        router.replace(`/admin/services/${created.id}?created=1`);
        return;
      }

      const changes = changedFields(payloadFrom(loaded), next);
      if (Object.keys(changes).length === 0 && !projectsChanged) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        setSaving(false);
        return;
      }

      let saved: Service = service;
      if (Object.keys(changes).length > 0) {
        saved = await api<Service>(`/api/admin/services/${service.id}`, { method: 'PATCH', json: changes });
      }
      if (projectsChanged) {
        const projects = await api<{ results: AdminServiceProject[] }>(
          `/api/admin/services/${service.id}/projects`,
          { method: 'PUT', json: projectsPayload(form.projects) },
        );
        saved = { ...saved, projects: projects.results };
      }
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!service) return;
    if (
      !window.confirm(
        `Delete “${service.title}”? Its page leaves the public site and it is removed from every project tagged with it. This cannot be undone — unpublishing keeps it for later.`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await api<void>(`/api/admin/services/${service.id}`, { method: 'DELETE' });
      router.replace('/admin/services');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  // DELETE is admin-only even though editors hold services:write.
  const canDelete = user.role === 'admin' && can('services:write');

  return (
    <>
      <PageHeader label="Services" title={service ? service.title : 'New service'}>
        {service ? (
          <>
            {publishedText(service)}
            {service.published ? (
              <>
                {' · '}
                <a className={linkText} href={`/services/${service.slug}`} target="_blank" rel="noopener noreferrer">
                  View on site
                </a>
              </>
            ) : null}
          </>
        ) : (
          'Saved as a draft unless you publish it below. It is added at the end of the list.'
        )}
      </PageHeader>

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Service">
          <Field id="s-title" label="Title">
            <input
              id="s-title"
              className={input}
              required
              minLength={2}
              maxLength={255}
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>
          <Field
            id="s-slug"
            label="Web address"
            optional={!service}
            hint={
              service
                ? 'The page lives at /services/ followed by this. Changing it breaks links already shared to the old address.'
                : 'Made from the title if left blank.'
            }
          >
            <input
              id="s-slug"
              className={input}
              required={Boolean(service)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="s-slug-hint"
            />
          </Field>
          <Field id="s-summary" label="Summary" hint={`The line on the service’s card. ${form.summary.length} of 300 characters.`}>
            <textarea
              id="s-summary"
              className={`${textarea} min-h-20`}
              required
              maxLength={300}
              value={form.summary}
              onChange={(event) => set('summary', event.target.value)}
              aria-describedby="s-summary-hint"
            />
          </Field>
          <Field id="s-standfirst" label="Standfirst" optional hint="Under the title at the top of the page. The summary is used if this is blank.">
            <textarea
              id="s-standfirst"
              className={`${textarea} min-h-20`}
              maxLength={600}
              value={form.standfirst}
              onChange={(event) => set('standfirst', event.target.value)}
              aria-describedby="s-standfirst-hint"
            />
          </Field>
          <Field id="s-body" label="Overview" optional hint="Separate paragraphs with a blank line.">
            <textarea
              id="s-body"
              className={`${textarea} leading-[1.7]`}
              rows={10}
              value={form.body}
              onChange={(event) => set('body', event.target.value)}
              aria-describedby="s-body-hint"
            />
          </Field>
          <label className={checkboxRow}>
            <input
              className={checkbox}
              type="checkbox"
              checked={form.informational}
              onChange={(event) => set('informational', event.target.checked)}
            />
            <span>
              Informational only
              <span className={`block ${muted}`}>
                No “discuss your project” action, and the licensing notice at the top of the page.
              </span>
            </span>
          </label>
        </FormSection>

        <FormSection title="Scope of work">
          <ListField id="s-covers" label="What this covers" value={form.covers} onChange={(v) => set('covers', v)} />
          <ListField
            id="s-deliverables"
            label="What the client is handed"
            value={form.deliverables}
            onChange={(v) => set('deliverables', v)}
          />
          <ListField id="s-suited" label="Suited to" value={form.suitedTo} onChange={(v) => set('suitedTo', v)} />
        </FormSection>

        <FormSection title="Process">
          <StepsField
            idPrefix="s-process"
            noun="step"
            value={form.process}
            onChange={(v) => set('process', v)}
          />
        </FormSection>

        <FormSection title="Benefits">
          <StepsField
            idPrefix="s-benefit"
            noun="benefit"
            value={form.benefits}
            onChange={(v) => set('benefits', v)}
          />
        </FormSection>

        <FormSection title="Projects on the page">
          <ProjectPicker value={form.projects} onChange={(v) => set('projects', v)} />
        </FormSection>

        <FormSection title="Search and sharing">
          <Field id="s-meta-title" label="Page title" optional hint="Defaults to the title.">
            <input
              id="s-meta-title"
              className={input}
              maxLength={255}
              value={form.metaTitle}
              onChange={(event) => set('metaTitle', event.target.value)}
              aria-describedby="s-meta-title-hint"
            />
          </Field>
          <Field
            id="s-meta-description"
            label="Search description"
            optional
            hint={`Defaults to the summary. ${form.metaDescription.length} of 160 characters.`}
          >
            <textarea
              id="s-meta-description"
              className={`${textarea} min-h-20`}
              maxLength={160}
              value={form.metaDescription}
              onChange={(event) => set('metaDescription', event.target.value)}
              aria-describedby="s-meta-description-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Publication">
          <fieldset className="flex flex-col gap-1">
            <legend className={`${fieldLabel} mb-1.5`}>Publication</legend>
            {[
              { published: false, label: 'Draft', note: 'Not on the public site.' },
              {
                published: true,
                label: 'Published',
                note: 'On the Services page and at its own address, within a minute of saving.',
              },
            ].map((option) => (
              <label key={option.label} className={`${checkboxRow} items-start py-2.5`}>
                <input
                  className={`${checkbox} mt-0.5`}
                  type="radio"
                  name="s-publication"
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
          <button className={btnSmallOrange} type="submit" disabled={saving || (Boolean(service) && !dirty)}>
            {saving ? 'Saving…' : service ? 'Save changes' : 'Create service'}
          </button>
          {service && dirty ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
          {!service ? (
            <Link className={btnSmall} href="/admin/services">
              Cancel
            </Link>
          ) : null}
          {service && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={saving} onClick={() => void remove()}>
              Delete service
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}

/** A bulleted list edited as one entry per line. */
function ListField({
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
  const count = lines(value).length;
  return (
    <Field id={id} label={label} optional hint={`One per line. ${count} of 30.`}>
      <textarea
        id={id}
        className={textarea}
        rows={6}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-hint`}
      />
    </Field>
  );
}

/** Moves the item at `index` by one place, or removes it. */
function moved<T>(items: T[], index: number, by: -1 | 1): T[] {
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(index + by, 0, item!);
  return next;
}

/** An ordered list of titled entries: the process steps or the benefits. */
function StepsField({
  idPrefix,
  noun,
  value,
  onChange,
}: {
  idPrefix: string;
  noun: string;
  value: ServiceStep[];
  onChange: (value: ServiceStep[]) => void;
}) {
  const plural = `${noun}s`;
  const update = (index: number, patch: Partial<ServiceStep>) =>
    onChange(value.map((step, i) => (i === index ? { ...step, ...patch } : step)));

  return (
    <div className="flex flex-col gap-4">
      {value.length === 0 ? (
        <p className={muted}>No {plural} yet. The section is left off the page until there is one.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {value.map((step, index) => (
            <li key={index} className="flex flex-col gap-3 border border-zinc-300 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`${fieldLabel} font-mono`}>
                  {noun} {String(index + 1).padStart(2, '0')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`${btnSmall} px-3`}
                    type="button"
                    disabled={index === 0}
                    onClick={() => onChange(moved(value, index, -1))}
                    aria-label={`Move ${noun} ${index + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    className={`${btnSmall} px-3`}
                    type="button"
                    disabled={index === value.length - 1}
                    onClick={() => onChange(moved(value, index, 1))}
                    aria-label={`Move ${noun} ${index + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    className={btnSmall}
                    type="button"
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  >
                    Remove<span className="sr-only"> {noun} {index + 1}</span>
                  </button>
                </div>
              </div>
              <Field id={`${idPrefix}-${index}-title`} label="Title">
                <input
                  id={`${idPrefix}-${index}-title`}
                  className={input}
                  maxLength={160}
                  value={step.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                />
              </Field>
              <Field id={`${idPrefix}-${index}-body`} label="Description" optional>
                <textarea
                  id={`${idPrefix}-${index}-body`}
                  className={`${textarea} min-h-20`}
                  maxLength={1000}
                  value={step.body}
                  onChange={(event) => update(index, { body: event.target.value })}
                />
              </Field>
            </li>
          ))}
        </ol>
      )}
      <div>
        <button
          className={btnSmall}
          type="button"
          disabled={value.length >= 12}
          onClick={() => onChange([...value, { title: '', body: '' }])}
        >
          Add {noun}
        </button>
      </div>
    </div>
  );
}

/**
 * The projects shown on the page, in order, with the ones marked as case
 * studies shown first and larger. Candidates come from the projects list,
 * drafts included: a draft can be lined up here and appears once published.
 */
function ProjectPicker({
  value,
  onChange,
}: {
  value: PickedProject[];
  onChange: (value: PickedProject[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const candidates = useResource<Page<AdminProject>>(
    withQuery('/api/projects', { includeUnpublished: 'true', q, pageSize: 8 }),
  );
  const chosen = new Set(value.map((project) => project.id));

  return (
    <div className="flex flex-col gap-5">
      {value.length === 0 ? (
        <p className={muted}>
          No projects yet. The Case studies and Related projects sections are left off the page until
          one is added.
        </p>
      ) : (
        <ol className="flex flex-col border border-zinc-300">
          {value.map((project, index) => (
            <li
              key={project.id}
              className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-[0.875rem] font-semibold break-words text-ink">{project.title}</p>
                <p className={muted}>
                  {project.isPublished ? 'Published' : 'Not published — hidden on the page until it is'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${checkboxRow} mr-2`}>
                  <input
                    className={checkbox}
                    type="checkbox"
                    checked={project.caseStudy}
                    onChange={(event) =>
                      onChange(value.map((p) => (p.id === project.id ? { ...p, caseStudy: event.target.checked } : p)))
                    }
                  />
                  Case study
                </label>
                <button
                  className={`${btnSmall} px-3`}
                  type="button"
                  disabled={index === 0}
                  onClick={() => onChange(moved(value, index, -1))}
                  aria-label={`Move ${project.title} up`}
                >
                  ↑
                </button>
                <button
                  className={`${btnSmall} px-3`}
                  type="button"
                  disabled={index === value.length - 1}
                  onClick={() => onChange(moved(value, index, 1))}
                  aria-label={`Move ${project.title} down`}
                >
                  ↓
                </button>
                <button
                  className={btnSmall}
                  type="button"
                  onClick={() => onChange(value.filter((p) => p.id !== project.id))}
                >
                  Remove<span className="sr-only"> {project.title}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col gap-3">
        <p className={fieldLabel} id="s-projects-add">
          Add a project
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="s-projects-search">
            Search projects
          </label>
          <input
            id="s-projects-search"
            className={`${filterInput} min-w-0 flex-1`}
            type="search"
            placeholder="Search projects"
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Inside the service form, Enter would submit it.
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
          <ul className="flex flex-col border border-zinc-300" aria-labelledby="s-projects-add">
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
                  disabled={chosen.has(project.id) || value.length >= 24}
                  onClick={() =>
                    onChange([
                      ...value,
                      {
                        id: project.id,
                        title: project.title,
                        slug: project.slug,
                        isPublished: project.isPublished,
                        caseStudy: false,
                      },
                    ])
                  }
                >
                  {chosen.has(project.id) ? 'Added' : 'Add'}
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
