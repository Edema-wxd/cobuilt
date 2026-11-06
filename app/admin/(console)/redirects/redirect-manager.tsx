'use client';

import { useState, type FormEvent } from 'react';
import type { AdminRedirect } from '@/lib/repositories/redirects';
import { checkDestination, checkSource } from '@/lib/redirectPaths';
import { ApiFailure, api } from '../../auth-client';
import {
  PageHeader,
  StateBox,
  btnSmall,
  btnSmallDanger,
  btnSmallOrange,
  formatDateTime,
  formatNumber,
  muted,
  panel,
  panelHead,
  panelTitle,
  td,
  th,
  useResource,
} from '../../kit';
import { Field, checkbox, checkboxRow, fieldLabel, input } from '../../form-kit';

/**
 * Redirects from old addresses — `GET`/`POST /api/admin/redirects`, `PATCH`
 * and `DELETE /api/admin/redirects/[id]`. Admin only.
 *
 * One screen: the form adds a rule, or edits the one chosen from the table.
 * Both ends are checked as they are typed with the API's own rules
 * (src/lib/redirectPaths.ts); the API adds the loop check, which needs the
 * other rules, and its message is shown as it comes. A rule applies only
 * where no page answers, which the header says so nobody expects a rule to
 * move a live page (docs/decisions.md §2.27).
 */

interface FormState {
  sourcePath: string;
  destination: string;
  permanent: boolean;
}

const EMPTY: FormState = { sourcePath: '', destination: '', permanent: true };

function typeText(redirect: Pick<AdminRedirect, 'permanent'>): string {
  return redirect.permanent ? 'Permanent (308)' : 'Temporary (307)';
}

export default function RedirectManager() {
  const list = useResource<{ results: AdminRedirect[] }>('/api/admin/redirects');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<AdminRedirect | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const sourceCheck = form.sourcePath.trim() ? checkSource(form.sourcePath) : null;
  const destinationCheck = form.destination.trim() ? checkDestination(form.destination) : null;
  const toItself =
    sourceCheck?.ok && destinationCheck?.ok && destinationCheck.value.sitePath === sourceCheck.value;

  function set<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset(): void {
    setForm(EMPTY);
    setEditing(null);
  }

  function edit(redirect: AdminRedirect): void {
    setEditing(redirect);
    setForm({
      sourcePath: redirect.sourcePath,
      destination: redirect.destination,
      permanent: redirect.permanent,
    });
    setMessage(null);
    document.getElementById('r-source')?.focus();
  }

  function fail(failure: unknown): void {
    setMessage({
      text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.',
      bad: true,
    });
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!sourceCheck?.ok || !destinationCheck?.ok || toItself) {
      setMessage({ text: 'Fix the highlighted field first.', bad: true });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      if (editing) {
        const changes: Partial<FormState> = {};
        if (sourceCheck.value !== editing.sourcePath) changes.sourcePath = form.sourcePath.trim();
        if (form.destination.trim() !== editing.destination) changes.destination = form.destination.trim();
        if (form.permanent !== editing.permanent) changes.permanent = form.permanent;
        if (Object.keys(changes).length === 0) {
          setMessage({ text: 'Nothing has changed.', bad: false });
          return;
        }
        const saved = await api<AdminRedirect>(`/api/admin/redirects/${editing.id}`, {
          method: 'PATCH',
          json: changes,
        });
        list.setData((current) => ({
          results: current.results.map((item) => (item.id === saved.id ? saved : item)),
        }));
        setMessage({ text: `${saved.sourcePath} now goes to ${saved.destination}.`, bad: false });
      } else {
        const saved = await api<AdminRedirect>('/api/admin/redirects', {
          method: 'POST',
          json: {
            sourcePath: form.sourcePath.trim(),
            destination: form.destination.trim(),
            permanent: form.permanent,
          },
        });
        list.setData((current) => ({
          results: [...current.results, saved].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)),
        }));
        setMessage({ text: `${saved.sourcePath} now redirects to ${saved.destination}.`, bad: false });
      }
      reset();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  async function remove(redirect: AdminRedirect): Promise<void> {
    if (!window.confirm(`Delete the redirect from ${redirect.sourcePath}? That address becomes a 404 again.`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/admin/redirects/${redirect.id}`, { method: 'DELETE' });
      list.setData((current) => ({ results: current.results.filter((item) => item.id !== redirect.id) }));
      if (editing?.id === redirect.id) reset();
      setMessage({ text: `The redirect from ${redirect.sourcePath} is deleted.`, bad: false });
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const redirects = list.data?.results ?? [];
  const sourceError = sourceCheck && !sourceCheck.ok ? sourceCheck.message : null;
  const destinationError =
    destinationCheck && !destinationCheck.ok
      ? destinationCheck.message
      : toItself
        ? 'A path cannot redirect to itself'
        : null;

  return (
    <>
      <PageHeader label="Redirects" title="Redirects">
        Send visitors and search engines from an old address to its new one. A redirect applies
        only where no page answers, so it can never take a live page off the site. Changes reach the
        site within a minute. Each visit sent on is counted, except under /services and /gallery,
        whose pages are cached: a redirect there counts once each time it is regenerated, at most
        once a minute.
      </PageHeader>

      <form className={`${panel} mb-6`} onSubmit={(event) => void save(event)} noValidate>
        <div className={panelHead}>
          <h2 className={panelTitle}>{editing ? `Edit ${editing.sourcePath}` : 'Add a redirect'}</h2>
        </div>
        <div className="flex max-w-2xl flex-col gap-5 px-5 py-5">
          <Field
            id="r-source"
            label="Old address"
            hint={sourceError ?? 'A path on this site, such as /about-us or /projects/old-name. Letter case and a trailing slash are ignored.'}
          >
            <input
              id="r-source"
              className={input}
              value={form.sourcePath}
              onChange={(event) => set('sourcePath', event.target.value)}
              aria-describedby="r-source-hint"
              aria-invalid={sourceError ? true : undefined}
              placeholder="/old-page"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </Field>

          <Field
            id="r-destination"
            label="New address"
            hint={destinationError ?? 'A path on this site, such as /projects/new-name, or a full https:// address elsewhere.'}
          >
            <input
              id="r-destination"
              className={input}
              value={form.destination}
              onChange={(event) => set('destination', event.target.value)}
              aria-describedby="r-destination-hint"
              aria-invalid={destinationError ? true : undefined}
              placeholder="/new-page"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </Field>

          <fieldset className="flex flex-col gap-1">
            <legend className={`${fieldLabel} mb-1.5`}>Type</legend>
            <label className={`${checkboxRow} items-start py-2`}>
              <input
                className={`${checkbox} mt-0.5`}
                type="radio"
                name="r-type"
                checked={form.permanent}
                onChange={() => set('permanent', true)}
              />
              <span>
                Permanent (308)
                <span className={`block ${muted}`}>
                  The page has moved for good. Search engines move the old address&rsquo;s standing to
                  the new one.
                </span>
              </span>
            </label>
            <label className={`${checkboxRow} items-start py-2`}>
              <input
                className={`${checkbox} mt-0.5`}
                type="radio"
                name="r-type"
                checked={!form.permanent}
                onChange={() => set('permanent', false)}
              />
              <span>
                Temporary (307)
                <span className={`block ${muted}`}>
                  For a while only. Search engines keep the old address.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button className={btnSmallOrange} type="submit" disabled={busy}>
              {editing ? 'Save changes' : 'Add redirect'}
            </button>
            {editing ? (
              <button className={btnSmall} type="button" disabled={busy} onClick={reset}>
                Cancel
              </button>
            ) : null}
            <p className={muted} role={message?.bad ? 'alert' : 'status'}>
              {message ? (
                <span className={message.bad ? 'text-msg-bad' : 'text-msg-ok'}>{message.text}</span>
              ) : null}
            </p>
          </div>
        </div>
      </form>

      <section className={panel} aria-busy={list.loading || busy}>
        <div className={panelHead}>
          <h2 className={panelTitle}>Rules</h2>
          {list.data ? <p className={muted}>{redirects.length} in all</p> : null}
        </div>

        {redirects.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty="There are no redirects. Add one above when an address changes."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl border-collapse">
              <thead>
                <tr>
                  <th className={th} scope="col">Old address</th>
                  <th className={th} scope="col">New address</th>
                  <th className={th} scope="col">Type</th>
                  <th className={th} scope="col">Hits</th>
                  <th className={th} scope="col">Last hit</th>
                  <th className={th} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {redirects.map((redirect) => (
                  <tr key={redirect.id}>
                    <td className={`${td} max-w-xs break-all font-mono text-[0.813rem]`}>
                      {redirect.sourcePath}
                    </td>
                    <td className={`${td} max-w-xs break-all font-mono text-[0.813rem]`}>
                      {redirect.destination}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{typeText(redirect)}</td>
                    <td className={`${td} font-mono`}>{formatNumber(redirect.hitCount)}</td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(redirect.lastHitAt)}</td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={btnSmall}
                          type="button"
                          disabled={busy}
                          onClick={() => edit(redirect)}
                          aria-label={`Edit the redirect from ${redirect.sourcePath}`}
                        >
                          Edit
                        </button>
                        <button
                          className={btnSmallDanger}
                          type="button"
                          disabled={busy}
                          onClick={() => void remove(redirect)}
                          aria-label={`Delete the redirect from ${redirect.sourcePath}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
