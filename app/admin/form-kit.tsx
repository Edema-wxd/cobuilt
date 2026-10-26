'use client';

import { useEffect, type ReactNode } from 'react';
import { field, fieldLabel, input } from '../../components/sections';
import { formatDateTime, muted, panel, panelHead, panelTitle } from './kit';

/**
 * Form primitives for the console's content editors (projects, news, Passport
 * milestones). They follow the register form's pattern — label above field,
 * 44px targets, 16px text on a phone — from docs/design-handover.md §4.
 */

export { field, fieldLabel, input };
export const textarea = `${input} min-h-28 py-2.5`;
export const checkboxRow =
  'flex min-h-target cursor-pointer items-center gap-2.5 text-[0.875rem] text-ink';
export const checkbox = 'size-4 flex-none accent-orange';
export const selectInput = `${input} select-chevron cursor-pointer pr-10`;

export function Optional() {
  return <span className="font-normal tracking-normal normal-case text-zinc-500"> (optional)</span>;
}

/** A labelled control. Pass the same `id` to the control, and `${id}-hint` as its aria-describedby when a hint is set. */
export function Field({
  id,
  label,
  optional,
  hint,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={field}>
      <label className={fieldLabel} htmlFor={id}>
        {label}
        {optional ? <Optional /> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className={muted}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** One titled panel of a long form. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className={panel}>
      <legend className="sr-only">{title}</legend>
      <div className={panelHead} aria-hidden="true">
        <p className={panelTitle}>{title}</p>
      </div>
      <div className="flex max-w-2xl flex-col gap-5 px-5 py-5">{children}</div>
    </fieldset>
  );
}

/** Empty text becomes null, which the write APIs take as "clear this field". */
export function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** One entry per non-empty line. */
export function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The first line that is not an http(s) URL, if any. */
export function firstBadUrl(urls: string[]): string | null {
  return urls.find((url) => !/^https?:\/\/\S+$/i.test(url)) ?? null;
}

/**
 * The fields of `next` whose value differs from `initial`.
 *
 * Editors send only what changed. That keeps the audit log's field list
 * truthful, and it matters for projects: any investor figure in an update
 * withdraws legal approval, so resending an untouched figure must not happen.
 */
export function changedFields<T extends Record<string, unknown>>(initial: T, next: T): Partial<T> {
  const changes: Partial<T> = {};
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (next[key] === undefined) continue;
    if (JSON.stringify(next[key]) !== JSON.stringify(initial[key])) changes[key] = next[key];
  }
  return changes;
}

/** Warns before leaving the page with unsaved edits. In-console links are not covered. */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

/*
 * Publication. Times are entered and shown in WAT (UTC+1, no daylight saving),
 * the office's zone, matching formatDateTime — whoever is reading.
 */

const WAT_OFFSET_MS = 60 * 60 * 1000;

/** An ISO instant as a `datetime-local` value in WAT. */
export function toWatInput(iso: string): string {
  return new Date(new Date(iso).getTime() + WAT_OFFSET_MS).toISOString().slice(0, 16);
}

/** A `datetime-local` value read as WAT, as an ISO instant. */
export function fromWatInput(value: string): string {
  return new Date(`${value}:00+01:00`).toISOString();
}

export type PublicationMode = 'draft' | 'live' | 'scheduled';

export interface Publication {
  mode: PublicationMode;
  /** `datetime-local` value in WAT; used when scheduled. */
  at: string;
}

export function publicationFrom(publishedAt: string | null): Publication {
  if (!publishedAt) return { mode: 'draft', at: '' };
  const future = new Date(publishedAt).getTime() > Date.now();
  return { mode: future ? 'scheduled' : 'live', at: toWatInput(publishedAt) };
}

/**
 * The `publishedAt` to send. Something already live keeps its original date,
 * so re-saving a published item does not move it to the top of the list.
 */
export function publishedAtFor(publication: Publication, original: string | null): string | null {
  if (publication.mode === 'draft') return null;
  if (publication.mode === 'scheduled') {
    if (!publication.at) return null;
    // The input drops seconds; an untouched time keeps the stored instant exactly.
    if (original && toWatInput(original) === publication.at) return original;
    return fromWatInput(publication.at);
  }
  if (original && new Date(original).getTime() <= Date.now()) return original;
  return new Date().toISOString();
}

export function PublicationField({
  idPrefix,
  value,
  original,
  disabled,
  onChange,
}: {
  idPrefix: string;
  value: Publication;
  original: string | null;
  disabled?: boolean;
  onChange: (next: Publication) => void;
}) {
  const options: Array<{ mode: PublicationMode; label: string; note: string }> = [
    { mode: 'draft', label: 'Draft', note: 'Not on the public site.' },
    {
      mode: 'live',
      label: 'Published',
      note:
        original && new Date(original).getTime() <= Date.now()
          ? `Live since ${formatDateTime(original)}.`
          : 'Goes live when you save.',
    },
    { mode: 'scheduled', label: 'Scheduled', note: 'Goes live at the time below (WAT).' },
  ];

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className={`${fieldLabel} mb-1.5`}>Publication</legend>
      {options.map((option) => (
        <label key={option.mode} className={`${checkboxRow} items-start py-2.5`}>
          <input
            className={`${checkbox} mt-0.5`}
            type="radio"
            name={`${idPrefix}-publication`}
            checked={value.mode === option.mode}
            disabled={disabled}
            onChange={() => onChange({ ...value, mode: option.mode })}
          />
          <span>
            {option.label}
            <span className={`block ${muted}`}>{option.note}</span>
          </span>
        </label>
      ))}
      {value.mode === 'scheduled' ? (
        <div className="mt-1 max-w-xs">
          <label className="sr-only" htmlFor={`${idPrefix}-publish-at`}>
            Publish at (WAT)
          </label>
          <input
            id={`${idPrefix}-publish-at`}
            className={input}
            type="datetime-local"
            required
            value={value.at}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, at: event.target.value })}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

/** Shown on a record mirrored from the CMS, whose next publish there replaces console edits. */
export function CmsNotice({ cms }: { cms: { source: string; syncedAt: string | null } | null }) {
  if (!cms) return null;
  return (
    <div className="mb-6 max-w-2xl border-l-3 border-orange bg-white px-4 py-3 text-[0.875rem] leading-[1.6] text-zinc-700">
      <p className="font-semibold text-ink">Managed in the CMS ({cms.source})</p>
      <p className="mt-1">
        Last synced {formatDateTime(cms.syncedAt)}. Edits made here are overwritten the next time this
        is published in the CMS, so make lasting changes there.
      </p>
    </div>
  );
}

/** The save bar at the foot of an editor. */
export function SaveBar({
  children,
  message,
}: {
  children: ReactNode;
  message: { text: string; bad: boolean } | null;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-gutter flex flex-wrap items-center gap-3 border-t border-zinc-300 bg-zinc-100/95 px-gutter py-3.5 backdrop-blur md:-mx-10 md:px-10">
      {children}
      {message ? (
        <p
          className={`text-[0.813rem] ${message.bad ? 'text-msg-bad' : 'text-msg-ok'}`}
          role={message.bad ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
