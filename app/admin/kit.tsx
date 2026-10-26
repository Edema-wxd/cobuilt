'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiFailure, api } from './auth-client';
import { eyebrow } from '../../components/ui';

/**
 * Primitives shared by the admin console's screens.
 *
 * The console is plainer than the public site but uses the same tokens, type
 * and colour rules (docs/design-handover.md §3, Tier 3): orange is a fill with
 * charcoal labels, rust carries accent text on white, and every control meets
 * the 44px target.
 */

export const panel = 'border border-zinc-300 bg-white';
export const panelHead =
  'flex flex-wrap items-center justify-between gap-3 border-b border-zinc-300 px-5 py-3.5';
export const panelTitle = 'text-[0.719rem] font-semibold uppercase tracking-[0.16em] text-ink';
export const th =
  'border-b border-zinc-300 px-4 py-3 text-left text-[0.688rem] font-semibold uppercase tracking-[0.12em] text-zinc-600';
export const td = 'border-b border-line px-4 py-3 align-top text-[0.875rem] text-zinc-700';
export const muted = 'text-[0.813rem] text-zinc-600';

const smallBtn =
  'inline-flex min-h-target cursor-pointer items-center justify-center border px-4 text-[0.688rem] font-semibold uppercase tracking-[0.14em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60';
export const btnSmall = `${smallBtn} border-zinc-300 bg-white text-ink enabled:hover:border-ink`;
export const btnSmallOrange = `${smallBtn} border-transparent bg-orange text-ink enabled:hover:bg-orange-lift`;
export const btnSmallDanger = `${smallBtn} border-msg-bad bg-white text-msg-bad enabled:hover:bg-zinc-100`;

/** A compact select for filter bars; 16px on a phone so iOS does not zoom. */
export const filterSelect =
  'select-chevron min-h-target cursor-pointer border border-zinc-400 bg-white pr-10 pl-3 text-base text-ink sm:text-[0.875rem]';
export const filterInput =
  'min-h-target border border-zinc-400 bg-white px-3 text-base text-ink placeholder:text-zinc-500 sm:text-[0.875rem]';

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Lagos',
});

/** Times are shown in WAT, the office's own zone, whoever is reading. */
export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('en-GB');
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface Page<T> {
  results: T[];
  pagination: Pagination;
}

interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  /** Replaces the loaded data in place, after a write returns the new row. */
  setData: (update: (current: T) => T) => void;
}

/**
 * Loads `path` and reloads whenever it changes. A response for a path the
 * screen has since moved away from is dropped, so a slow first page cannot
 * overwrite the second.
 */
export function useResource<T>(path: string | null): Resource<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let current = true;
    setLoading(true);
    setError(null);

    api<T>(path)
      .then((result) => {
        if (current) setDataState(result);
      })
      .catch((failure: unknown) => {
        if (!current) return;
        setError(failure instanceof ApiFailure ? failure.message : 'No connection to the server.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback(
    (update: (current: T) => T) => setDataState((current) => (current ? update(current) : current)),
    [],
  );

  return { data, error, loading, reload, setData };
}

/** Builds a query string, leaving out filters that are not set. */
export function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(name, String(value));
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

export function PageHeader({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2.5 pb-6">
      <p className={eyebrow}>{label}</p>
      <h1 className="text-[length:clamp(1.75rem,3vw,2.25rem)] text-ink">{title}</h1>
      {children ? <div className="max-w-2xl text-[0.938rem] leading-[1.7] text-zinc-600">{children}</div> : null}
    </header>
  );
}

/** Loading, failure and empty states share one box so a screen never collapses to nothing. */
export function StateBox({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty?: string;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-4 px-5 py-8" role="alert">
        <p className="text-[0.875rem] text-msg-bad">{error}</p>
        {onRetry ? (
          <button className={btnSmall} type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }
  if (loading) {
    return (
      <p className={`px-5 py-8 ${muted}`} role="status">
        Loading…
      </p>
    );
  }
  return empty ? <p className={`px-5 py-8 ${muted}`}>{empty}</p> : null;
}

export function Pager({
  pagination,
  onPage,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
      aria-label="Pagination"
    >
      <p className={muted}>
        Page {pagination.page} of {pagination.totalPages} · {formatNumber(pagination.total)} in all
      </p>
      <div className="flex gap-2">
        <button
          className={btnSmall}
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
        >
          Previous
        </button>
        <button
          className={btnSmall}
          type="button"
          disabled={!pagination.hasNextPage}
          onClick={() => onPage(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/** A label/value pair in a detail view. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[0.688rem] font-semibold uppercase tracking-[0.12em] text-zinc-600">
        {label}
      </dt>
      <dd className="text-[0.906rem] break-words text-ink">{children}</dd>
    </div>
  );
}
