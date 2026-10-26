'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { serializeMilestoneForAdmin } from '@/lib/serializers';
import { ApiFailure, api } from '../../../../auth-client';
import { useSession } from '../../../console-shell';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
  muted,
  panel,
  panelHead,
  panelTitle,
  td,
  th,
  useResource,
} from '../../../../kit';
import {
  Field,
  changedFields,
  checkbox,
  checkboxRow,
  firstBadUrl,
  input,
  lines,
  orNull,
  selectInput,
  textarea,
} from '../../../../form-kit';
import { linkText } from '../../project-list';

/**
 * Project Passport™ milestones — `GET /api/projects/[id]/passport` with
 * `includeInternal`, `POST` to record one, and `PUT` / `DELETE` on
 * `/api/projects/[id]/passport/[milestoneId]` (delete is admin-only).
 */

type Milestone = ReturnType<typeof serializeMilestoneForAdmin>;
type MilestoneType = Milestone['type'];
type MilestoneStatus = Milestone['status'];

interface Timeline {
  project: { id: string; title: string; slug: string };
  passportEnabled: boolean;
  progress: { total: number; completed: number; percentComplete: number };
  milestones: Milestone[];
}

const TYPE_LABELS: Record<MilestoneType, string> = {
  commencement: 'Commencement',
  foundation: 'Foundation',
  superstructure: 'Superstructure',
  roofing: 'Roofing',
  mep: 'MEP (mechanical, electrical, plumbing)',
  finishes: 'Finishes',
  practical_completion: 'Practical completion',
  handover: 'Handover',
  custom: 'Custom',
};

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  delayed: 'Delayed',
};

const STATUS_TONE: Record<MilestoneStatus, string> = {
  pending: 'text-zinc-700',
  in_progress: 'text-ink',
  completed: 'text-msg-ok',
  delayed: 'text-msg-bad',
};

const dateOnly = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });

function formatDate(value: string | null): string {
  return value ? dateOnly.format(new Date(`${value}T00:00:00Z`)) : '—';
}

function failureText(failure: unknown): string {
  return failure instanceof ApiFailure ? failure.message : 'No connection to the server.';
}

export default function MilestoneManager({ projectId }: { projectId: string }) {
  const { user, can } = useSession();
  const timeline = useResource<Timeline>(`/api/projects/${projectId}/passport?includeInternal=true`);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const canDelete = user.role === 'admin' && can('passport:write');

  const data = timeline.data;

  return (
    <>
      <PageHeader label="Project Passport™" title={data ? data.project.title : 'Passport milestones'}>
        <Link className={linkText} href={`/admin/projects/${projectId}`}>
          Back to the project
        </Link>
        {data ? (
          <>
            {' · '}
            {data.progress.completed} of {data.progress.total} public milestones complete (
            {data.progress.percentComplete}%)
          </>
        ) : null}
      </PageHeader>

      {data && !data.passportEnabled ? (
        <div className="mb-6 max-w-2xl border-l-3 border-orange bg-white px-4 py-3 text-[0.875rem] text-zinc-700">
          The Passport is switched off for this project, so none of these show publicly yet. Turn it on
          in the{' '}
          <Link className={linkText} href={`/admin/projects/${projectId}`}>
            project settings
          </Link>
          .
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <section className={panel} aria-busy={timeline.loading}>
          <div className={panelHead}>
            <h2 className={panelTitle}>Milestones</h2>
            {data ? <p className={muted}>{data.milestones.length} in all</p> : null}
          </div>

          {!data || data.milestones.length === 0 ? (
            <StateBox
              loading={timeline.loading}
              error={timeline.error}
              onRetry={timeline.reload}
              empty="No milestones yet. Record the first one below."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl border-collapse">
                <thead>
                  <tr>
                    <th className={th} scope="col">Order</th>
                    <th className={th} scope="col">Milestone</th>
                    <th className={th} scope="col">Status</th>
                    <th className={th} scope="col">Scheduled</th>
                    <th className={th} scope="col">Actual</th>
                    <th className={th} scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.milestones.map((milestone) => (
                    <MilestoneRow
                      key={milestone.id}
                      projectId={projectId}
                      milestone={milestone}
                      isEditing={editing?.id === milestone.id}
                      canDelete={canDelete}
                      onEdit={() => setEditing(milestone)}
                      onDeleted={() => {
                        if (editing?.id === milestone.id) setEditing(null);
                        timeline.reload();
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!canDelete && data && data.milestones.length > 0 ? (
            <p className={`border-t border-line px-5 py-3.5 ${muted}`}>
              Only an administrator can delete a milestone.
            </p>
          ) : null}
        </section>

        <MilestoneForm
          key={editing?.id ?? 'new'}
          projectId={projectId}
          milestone={editing}
          nextOrder={data ? Math.max(-1, ...data.milestones.map((m) => m.sortOrder)) + 1 : 0}
          onSaved={() => {
            setEditing(null);
            // Progress and order both come from the server, so reload rather than patch.
            timeline.reload();
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    </>
  );
}

function MilestoneRow({
  projectId,
  milestone,
  isEditing,
  canDelete,
  onEdit,
  onDeleted,
}: {
  projectId: string;
  milestone: Milestone;
  isEditing: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const name = milestone.title ?? TYPE_LABELS[milestone.type];

  async function remove(): Promise<void> {
    if (!window.confirm(`Delete the “${name}” milestone? This cannot be undone.`)) return;
    setDeleting(true);
    setError('');
    try {
      await api<void>(`/api/projects/${projectId}/passport/${milestone.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (failure) {
      setError(failureText(failure));
      setDeleting(false);
    }
  }

  return (
    <tr className={isEditing ? 'bg-zinc-100' : undefined}>
      <td className={`${td} tabular-nums`}>{milestone.sortOrder}</td>
      <td className={`${td} max-w-xs`}>
        <span className="font-semibold text-ink">{name}</span>
        <span className={`block ${muted}`}>
          {milestone.title ? `${TYPE_LABELS[milestone.type]} · ` : ''}
          {milestone.isPublic ? 'Public' : 'Internal only'}
          {milestone.photoUrls.length > 0 ? ` · ${milestone.photoUrls.length} photos` : ''}
          {milestone.documentUrls.length > 0 ? ` · ${milestone.documentUrls.length} documents` : ''}
        </span>
      </td>
      <td className={`${td} ${STATUS_TONE[milestone.status]}`}>{STATUS_LABELS[milestone.status]}</td>
      <td className={`${td} whitespace-nowrap`}>{formatDate(milestone.scheduledDate)}</td>
      <td className={`${td} whitespace-nowrap`}>{formatDate(milestone.actualDate)}</td>
      <td className={`${td} text-right`}>
        <div className="flex justify-end gap-2">
          <button
            className={btnSmall}
            type="button"
            disabled={deleting || isEditing}
            onClick={onEdit}
            aria-label={`Edit ${name}`}
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

interface FormState {
  milestoneType: MilestoneType;
  title: string;
  description: string;
  status: MilestoneStatus;
  scheduledDate: string;
  actualDate: string;
  sortOrder: string;
  photoUrls: string;
  documentUrls: string;
  videoUrl: string;
  isPublic: boolean;
}

function formFrom(milestone: Milestone | null, nextOrder: number): FormState {
  return {
    milestoneType: milestone?.type ?? 'commencement',
    title: milestone?.title ?? '',
    description: milestone?.description ?? '',
    status: milestone?.status ?? 'pending',
    scheduledDate: milestone?.scheduledDate ?? '',
    actualDate: milestone?.actualDate ?? '',
    sortOrder: String(milestone?.sortOrder ?? nextOrder),
    photoUrls: milestone?.photoUrls.join('\n') ?? '',
    documentUrls: milestone?.documentUrls.join('\n') ?? '',
    videoUrl: milestone?.videoUrl ?? '',
    isPublic: milestone?.isPublic ?? true,
  };
}

function payloadFrom(form: FormState) {
  const photoUrls = lines(form.photoUrls);
  const documentUrls = lines(form.documentUrls);
  const bad = firstBadUrl([...photoUrls, ...documentUrls]);
  if (bad) throw new ApiFailure(0, `“${bad}” is not a web address. Photos and documents need one per line.`);
  if (form.status === 'completed' && !form.actualDate) {
    throw new ApiFailure(0, 'A completed milestone needs its actual date.');
  }

  return {
    milestoneType: form.milestoneType,
    title: orNull(form.title),
    description: orNull(form.description),
    status: form.status,
    scheduledDate: form.scheduledDate || null,
    actualDate: form.actualDate || null,
    sortOrder: Number(form.sortOrder) || 0,
    photoUrls,
    documentUrls,
    videoUrl: orNull(form.videoUrl),
    isPublic: form.isPublic,
  };
}

function MilestoneForm({
  projectId,
  milestone,
  nextOrder,
  onSaved,
  onCancel,
}: {
  projectId: string;
  milestone: Milestone | null;
  nextOrder: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const loaded = formFrom(milestone, nextOrder);
  const [form, setForm] = useState<FormState>(loaded);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  // Opening an edit moves focus to the form, which also scrolls it into view.
  useEffect(() => {
    if (milestone) firstRef.current?.focus();
  }, [milestone]);

  // The next free position, once the list has loaded, for a form not yet touched.
  useEffect(() => {
    if (!milestone) setForm((current) => (current.sortOrder === '0' ? { ...current, sortOrder: String(nextOrder) } : current));
  }, [milestone, nextOrder]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    try {
      const next = payloadFrom(form);

      if (milestone) {
        const changes = changedFields(payloadFrom(loaded), next);
        if (Object.keys(changes).length === 0) {
          setMessage({ text: 'Nothing has changed.', bad: false });
          return;
        }
        // The API checks a completed milestone's date within the update itself,
        // so the date goes with any change to a completed milestone's status.
        if (changes.status === 'completed') changes.actualDate = next.actualDate;

        setSaving(true);
        await api<Milestone>(`/api/projects/${projectId}/passport/${milestone.id}`, {
          method: 'PUT',
          json: changes,
        });
      } else {
        setSaving(true);
        await api<Milestone>(`/api/projects/${projectId}/passport`, { method: 'POST', json: next });
        setForm(formFrom(null, nextOrder + 1));
        setMessage({ text: 'Milestone recorded.', bad: false });
      }
      onSaved();
    } catch (failure) {
      setMessage({ text: failureText(failure), bad: true });
    } finally {
      setSaving(false);
    }
  }

  const heading = milestone ? `Edit “${milestone.title ?? TYPE_LABELS[milestone.type]}”` : 'Record a milestone';

  return (
    <section className={panel}>
      <div className={panelHead}>
        <h2 className={panelTitle}>{heading}</h2>
      </div>

      <form className="flex max-w-2xl flex-col gap-5 px-5 py-5" onSubmit={(event) => void save(event)}>
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field id="m-type" label="Stage">
            <select
              ref={firstRef}
              id="m-type"
              className={selectInput}
              value={form.milestoneType}
              disabled={saving}
              onChange={(event) => set('milestoneType', event.target.value as MilestoneType)}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="m-order" label="Order">
            <input
              id="m-order"
              className={`${input} tabular-nums`}
              type="number"
              min={0}
              max={9999}
              required
              value={form.sortOrder}
              disabled={saving}
              onChange={(event) => set('sortOrder', event.target.value)}
            />
          </Field>
        </div>

        <Field
          id="m-title"
          label="Title"
          optional={form.milestoneType !== 'custom'}
          hint={form.milestoneType === 'custom' ? undefined : 'Defaults to the stage name.'}
        >
          <input
            id="m-title"
            className={input}
            maxLength={255}
            required={form.milestoneType === 'custom'}
            value={form.title}
            disabled={saving}
            onChange={(event) => set('title', event.target.value)}
            aria-describedby="m-title-hint"
          />
        </Field>

        <Field id="m-status" label="Status">
          <select
            id="m-status"
            className={selectInput}
            value={form.status}
            disabled={saving}
            onChange={(event) => set('status', event.target.value as MilestoneStatus)}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="m-scheduled" label="Scheduled date" optional>
            <input
              id="m-scheduled"
              className={input}
              type="date"
              value={form.scheduledDate}
              disabled={saving}
              onChange={(event) => set('scheduledDate', event.target.value)}
            />
          </Field>
          <Field
            id="m-actual"
            label="Actual date"
            optional={form.status !== 'completed'}
            hint={form.status === 'completed' ? 'Required once a milestone is completed.' : undefined}
          >
            <input
              id="m-actual"
              className={input}
              type="date"
              required={form.status === 'completed'}
              value={form.actualDate}
              disabled={saving}
              onChange={(event) => set('actualDate', event.target.value)}
              aria-describedby="m-actual-hint"
            />
          </Field>
        </div>

        <Field id="m-description" label="Description" optional>
          <textarea
            id="m-description"
            className={textarea}
            maxLength={10_000}
            value={form.description}
            disabled={saving}
            onChange={(event) => set('description', event.target.value)}
          />
        </Field>

        <Field id="m-photos" label="Photos" optional hint="One web address per line.">
          <textarea
            id="m-photos"
            className={`${textarea} min-h-20 font-mono text-[0.813rem]`}
            value={form.photoUrls}
            disabled={saving}
            onChange={(event) => set('photoUrls', event.target.value)}
            aria-describedby="m-photos-hint"
          />
        </Field>

        <Field id="m-documents" label="Documents" optional hint="One web address per line. The file name is shown as its title.">
          <textarea
            id="m-documents"
            className={`${textarea} min-h-20 font-mono text-[0.813rem]`}
            value={form.documentUrls}
            disabled={saving}
            onChange={(event) => set('documentUrls', event.target.value)}
            aria-describedby="m-documents-hint"
          />
        </Field>

        <Field id="m-video" label="Video" optional>
          <input
            id="m-video"
            className={input}
            type="url"
            inputMode="url"
            placeholder="https://"
            maxLength={512}
            value={form.videoUrl}
            disabled={saving}
            onChange={(event) => set('videoUrl', event.target.value)}
          />
        </Field>

        <label className={checkboxRow}>
          <input
            className={checkbox}
            type="checkbox"
            checked={form.isPublic}
            disabled={saving}
            onChange={(event) => set('isPublic', event.target.checked)}
          />
          <span>
            Public
            <span className={`block ${muted}`}>
              Untick to keep it on the internal record only. Internal milestones do not count towards
              public progress.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button className={btnSmallOrange} type="submit" disabled={saving}>
            {saving ? 'Saving…' : milestone ? 'Save changes' : 'Record milestone'}
          </button>
          {milestone ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={onCancel}>
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
