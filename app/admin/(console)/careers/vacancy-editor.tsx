'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SALARY_PERIODS,
  VACANCY_TYPES,
  VACANCY_TYPE_LABELS,
  WORK_PATTERNS,
  WORK_PATTERN_LABELS,
  lagosToday,
  type SalaryPeriod,
  type VacancyType,
  type WorkPattern,
} from '@/lib/careers';
import { ApiFailure, api } from '../../auth-client';
import { useSession } from '../console-shell';
import { PageHeader, StateBox, btnSmall, btnSmallDanger, btnSmallOrange, formatNumber, muted, panel, useResource } from '../../kit';
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
  selectInput,
  textarea,
  useUnsavedChanges,
} from '../../form-kit';
import { linkText } from '../projects/project-list';
import { vacancyState, type AdminVacancy } from './vacancy-list';

/**
 * Add and edit a vacancy — `POST /api/admin/careers/vacancies`, `PATCH` and
 * `DELETE /api/admin/careers/vacancies/[id]` (delete is admin-only, and
 * refused while the vacancy holds applications).
 *
 * The lists — responsibilities, requirements, benefits — are one entry per
 * line. A salary is optional and shown publicly only when given; the closing
 * date is the last day applications are taken, in West Africa Time. An
 * update sends only what changed.
 */

interface FormState {
  title: string;
  slug: string;
  type: VacancyType;
  department: string;
  location: string;
  workPattern: WorkPattern | '';
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: SalaryPeriod;
  closingDate: string;
  published: boolean;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  type: 'full_time',
  department: '',
  location: 'Lagos',
  workPattern: '',
  summary: '',
  description: '',
  responsibilities: '',
  requirements: '',
  benefits: '',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'NGN',
  salaryPeriod: 'month',
  closingDate: '',
  published: false,
};

const TYPE_HINTS: Record<VacancyType, string> = {
  full_time: 'A permanent, full-time role.',
  part_time: 'A permanent role on fewer hours; say how many in the description.',
  contract: 'A fixed-term or freelance engagement; say how long in the description.',
  graduate: 'For recent graduates. Listed under “Graduate opportunities” on the Careers page.',
  internship: 'A fixed period of work experience. Listed under “Internship programme” on the Careers page.',
};

function formFrom(vacancy: AdminVacancy): FormState {
  return {
    title: vacancy.title,
    slug: vacancy.slug,
    type: vacancy.type,
    department: vacancy.department ?? '',
    location: vacancy.location,
    workPattern: vacancy.workPattern ?? '',
    summary: vacancy.summary,
    description: vacancy.description ?? '',
    responsibilities: vacancy.responsibilities.join('\n'),
    requirements: vacancy.requirements.join('\n'),
    benefits: vacancy.benefits.join('\n'),
    salaryMin: vacancy.salary?.min?.toString() ?? '',
    salaryMax: vacancy.salary?.max?.toString() ?? '',
    salaryCurrency: vacancy.salary?.currency ?? 'NGN',
    salaryPeriod: vacancy.salary?.period ?? 'month',
    closingDate: vacancy.closingDate ?? '',
    published: vacancy.published,
  };
}

function entries(value: string, label: string): string[] {
  const items = [...new Set(lines(value))];
  if (items.length > 25) throw new ApiFailure(0, `${label}: at most 25 entries.`);
  const long = items.find((item) => item.length > 400);
  if (long) throw new ApiFailure(0, `${label}: each entry is at most 400 characters.`);
  const short = items.find((item) => item.length < 2);
  if (short) throw new ApiFailure(0, `${label}: each entry needs at least two characters.`);
  return items;
}

function amount(value: string, label: string): number | null {
  const digits = value.replace(/[\s,]/g, '');
  if (!digits) return null;
  if (!/^\d+$/.test(digits) || Number(digits) <= 0) {
    throw new ApiFailure(0, `${label} must be a whole number, without the currency sign.`);
  }
  return Number(digits);
}

function payloadFrom(form: FormState) {
  const min = amount(form.salaryMin, 'The lower salary figure');
  const max = amount(form.salaryMax, 'The upper salary figure');
  if (min !== null && max !== null && min > max) {
    throw new ApiFailure(0, 'The upper salary figure must not be below the lower one.');
  }
  const currency = form.salaryCurrency.trim().toUpperCase() || 'NGN';
  if (!/^[A-Z]{3}$/.test(currency)) throw new ApiFailure(0, 'The currency is a three-letter code, such as NGN.');

  return {
    title: form.title.trim(),
    // A web address cannot be cleared, only changed; blank on create derives one from the title.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    type: form.type,
    department: orNull(form.department),
    location: form.location.trim(),
    workPattern: form.workPattern === '' ? null : form.workPattern,
    summary: form.summary.trim(),
    description: orNull(form.description),
    responsibilities: entries(form.responsibilities, 'What the role involves'),
    requirements: entries(form.requirements, 'What it asks for'),
    benefits: entries(form.benefits, 'Benefits'),
    salary: min === null && max === null ? null : { min, max, currency, period: form.salaryPeriod },
    closingDate: form.closingDate || null,
    published: form.published,
  };
}

export default function VacancyEditor({ vacancyId }: { vacancyId: string | null }) {
  const vacancy = useResource<AdminVacancy>(vacancyId ? `/api/admin/careers/vacancies/${vacancyId}` : null);
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Vacancy added.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (vacancyId && !vacancy.data) {
    return (
      <>
        <PageHeader label="Careers" title="Edit vacancy" />
        <section className={panel} aria-busy={vacancy.loading}>
          <StateBox loading={vacancy.loading} error={vacancy.error} onRetry={vacancy.reload} />
        </section>
      </>
    );
  }

  return (
    <VacancyForm
      key={vacancy.data?.updatedAt ?? 'new'}
      vacancy={vacancy.data}
      notice={notice}
      onSaved={(saved) => {
        setNotice('Changes saved. The Careers page follows within a minute.');
        vacancy.setData(() => saved);
      }}
    />
  );
}

function VacancyForm({
  vacancy,
  notice,
  onSaved,
}: {
  vacancy: AdminVacancy | null;
  notice: string | null;
  onSaved: (saved: AdminVacancy) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = vacancy ? formFrom(vacancy) : EMPTY;
  const [form, setForm] = useState<FormState>(loaded);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(
    notice ? { text: notice, bad: false } : null,
  );

  const dirty = JSON.stringify(form) !== JSON.stringify(loaded);
  useUnsavedChanges(dirty && !busy);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setBusy(true);

    try {
      const next = payloadFrom(form);

      if (!vacancy) {
        const created = await api<AdminVacancy>('/api/admin/careers/vacancies', { method: 'POST', json: next });
        router.replace(`/admin/careers/${created.id}?created=1`);
        return;
      }

      const changes = changedFields(payloadFrom(loaded), next);
      if (Object.keys(changes).length === 0) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        setBusy(false);
        return;
      }

      const saved = await api<AdminVacancy>(`/api/admin/careers/vacancies/${vacancy.id}`, {
        method: 'PATCH',
        json: changes,
      });
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!vacancy) return;
    if (!window.confirm(`Delete “${vacancy.title}”? This cannot be undone — unpublishing keeps it for later.`)) return;

    setBusy(true);
    try {
      await api<void>(`/api/admin/careers/vacancies/${vacancy.id}`, { method: 'DELETE' });
      router.replace('/admin/careers');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setBusy(false);
    }
  }

  // DELETE is admin-only even though editors hold careers:write.
  const canDelete = user.role === 'admin' && can('careers:write');
  const closingPassed = Boolean(form.closingDate) && form.closingDate < lagosToday();

  return (
    <>
      <PageHeader label="Careers" title={vacancy ? vacancy.title : 'Add a vacancy'}>
        {vacancy ? (
          <>
            {vacancyState(vacancy).label} · {formatNumber(vacancy.applicationCount)}{' '}
            {vacancy.applicationCount === 1 ? 'application' : 'applications'}
            {can('applications:read') && vacancy.applicationCount > 0 ? (
              <>
                {' · '}
                <Link className={linkText} href={`/admin/applications?vacancy=${vacancy.id}`}>
                  Read them
                </Link>
              </>
            ) : null}
            {vacancy.published ? (
              <>
                {' · '}
                <a className={linkText} href={`/careers/${vacancy.slug}`} target="_blank" rel="noopener noreferrer">
                  View on the site<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </>
            ) : null}
          </>
        ) : (
          'Saved as a draft unless you publish it below. It is added at the end of the list.'
        )}
      </PageHeader>

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="The role">
          <Field id="v-title" label="Job title" hint="As candidates search for it, such as “Quantity Surveyor”.">
            <input
              id="v-title"
              className={input}
              required
              minLength={2}
              maxLength={255}
              value={form.title}
              disabled={busy}
              onChange={(event) => set('title', event.target.value)}
              aria-describedby="v-title-hint"
            />
          </Field>
          <Field id="v-type" label="Type" hint={TYPE_HINTS[form.type]}>
            <select
              id="v-type"
              className={selectInput}
              value={form.type}
              disabled={busy}
              onChange={(event) => set('type', event.target.value as VacancyType)}
              aria-describedby="v-type-hint"
            >
              {VACANCY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {VACANCY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="v-department" label="Discipline" optional hint="Such as “Quantity surveying and cost control”.">
            <input
              id="v-department"
              className={input}
              maxLength={120}
              value={form.department}
              disabled={busy}
              onChange={(event) => set('department', event.target.value)}
              aria-describedby="v-department-hint"
            />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="v-location" label="Location" hint="A city or site, such as “Lekki, Lagos”.">
              <input
                id="v-location"
                className={input}
                required
                minLength={2}
                maxLength={160}
                value={form.location}
                disabled={busy}
                onChange={(event) => set('location', event.target.value)}
                aria-describedby="v-location-hint"
              />
            </Field>
            <Field id="v-pattern" label="Work pattern" optional>
              <select
                id="v-pattern"
                className={selectInput}
                value={form.workPattern}
                disabled={busy}
                onChange={(event) => set('workPattern', event.target.value as WorkPattern | '')}
              >
                <option value="">Not stated</option>
                {WORK_PATTERNS.map((pattern) => (
                  <option key={pattern} value={pattern}>
                    {WORK_PATTERN_LABELS[pattern]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            id="v-slug"
            label="Web address"
            optional={!vacancy}
            hint={vacancy ? `cobuilt.com/careers/${form.slug || '…'}` : 'Made from the title if left blank.'}
          >
            <input
              id="v-slug"
              className={input}
              required={Boolean(vacancy)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              disabled={busy}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="v-slug-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="The advert">
          <Field
            id="v-summary"
            label="Summary"
            hint={`One or two sentences, on the card on the Careers page and under the title. ${form.summary.length} of 400 characters.`}
          >
            <textarea
              id="v-summary"
              className={`${textarea} min-h-20`}
              required
              minLength={10}
              maxLength={400}
              value={form.summary}
              disabled={busy}
              onChange={(event) => set('summary', event.target.value)}
              aria-describedby="v-summary-hint"
            />
          </Field>
          <Field id="v-description" label="About the role" optional hint="Paragraphs, separated by a blank line.">
            <textarea
              id="v-description"
              className={`${textarea} min-h-40`}
              maxLength={10_000}
              value={form.description}
              disabled={busy}
              onChange={(event) => set('description', event.target.value)}
              aria-describedby="v-description-hint"
            />
          </Field>
          {(
            [
              ['responsibilities', 'What the role involves', 'Responsibilities, one per line.'],
              ['requirements', 'What it asks for', 'Qualifications and experience, one per line.'],
              ['benefits', 'Benefits', 'What comes with the role, one per line. Only what is confirmed for it.'],
            ] as const
          ).map(([key, label, hint]) => (
            <Field key={key} id={`v-${key}`} label={label} optional hint={hint}>
              <textarea
                id={`v-${key}`}
                className={`${textarea} min-h-28`}
                value={form[key]}
                disabled={busy}
                onChange={(event) => set(key, event.target.value)}
                aria-describedby={`v-${key}-hint`}
              />
            </Field>
          ))}
        </FormSection>

        <FormSection title="Salary">
          <p className={muted}>
            Optional. Leave both figures blank to publish no salary; it is then left out of the page and of
            what search engines are told.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field id="v-salary-min" label="From" optional>
              <input
                id="v-salary-min"
                className={input}
                inputMode="numeric"
                value={form.salaryMin}
                disabled={busy}
                onChange={(event) => set('salaryMin', event.target.value)}
              />
            </Field>
            <Field id="v-salary-max" label="Up to" optional>
              <input
                id="v-salary-max"
                className={input}
                inputMode="numeric"
                value={form.salaryMax}
                disabled={busy}
                onChange={(event) => set('salaryMax', event.target.value)}
              />
            </Field>
            <Field id="v-salary-currency" label="Currency" hint="A three-letter code.">
              <input
                id="v-salary-currency"
                className={input}
                maxLength={3}
                autoCapitalize="characters"
                value={form.salaryCurrency}
                disabled={busy}
                onChange={(event) => set('salaryCurrency', event.target.value)}
                aria-describedby="v-salary-currency-hint"
              />
            </Field>
            <Field id="v-salary-period" label="Per">
              <select
                id="v-salary-period"
                className={selectInput}
                value={form.salaryPeriod}
                disabled={busy}
                onChange={(event) => set('salaryPeriod', event.target.value as SalaryPeriod)}
              >
                {SALARY_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period === 'year' ? 'Year' : 'Month'}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Closing date and publication">
          <Field
            id="v-closing"
            label="Closing date"
            optional
            hint={
              closingPassed
                ? 'This date has passed: the vacancy is off the Careers page and refuses applications. Its page stays up and says it has closed.'
                : 'The last day applications are taken, to the end of the day in West Africa Time. Leave blank for “open until filled”.'
            }
          >
            <input
              id="v-closing"
              className={`${input} max-w-xs`}
              type="date"
              value={form.closingDate}
              disabled={busy}
              onChange={(event) => set('closingDate', event.target.value)}
              aria-describedby="v-closing-hint"
            />
          </Field>
          <fieldset className="flex flex-col gap-1">
            <legend className={`${fieldLabel} mb-1.5`}>Publication</legend>
            {[
              { published: false, label: 'Draft', note: 'Not on the public site, and takes no applications.' },
              {
                published: true,
                label: 'Published',
                note: 'On the Careers page, taking applications, within a minute of saving — until the closing date.',
              },
            ].map((option) => (
              <label key={option.label} className={`${checkboxRow} items-start py-2.5`}>
                <input
                  className={`${checkbox} mt-0.5`}
                  type="radio"
                  name="v-publication"
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
          <button className={btnSmallOrange} type="submit" disabled={busy || (Boolean(vacancy) && !dirty)}>
            {busy ? 'Saving…' : vacancy ? 'Save changes' : 'Add vacancy'}
          </button>
          {vacancy && dirty ? (
            <button className={btnSmall} type="button" disabled={busy} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
          {!vacancy ? (
            <Link className={btnSmall} href="/admin/careers">
              Cancel
            </Link>
          ) : null}
          {vacancy && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={busy} onClick={() => void remove()}>
              Delete vacancy
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}
