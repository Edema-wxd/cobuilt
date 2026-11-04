'use client';

import { useState } from 'react';
import type { ContactSettings as Settings } from '@/lib/schemas/settings';
import { hoursText } from '@/lib/contactDetails';
import { ApiFailure, api } from '../../auth-client';
import { PageHeader, StateBox, btnSmall, btnSmallOrange, formatDateTime, muted, panel, useResource } from '../../kit';
import { Field, FormSection, SaveBar, fieldLabel, input, lines, textarea, useUnsavedChanges } from '../../form-kit';
import { linkText } from '../projects/project-list';

/**
 * Contact details — `GET` and `PUT /api/admin/settings/contact`, admin only
 * (`settings:write`).
 *
 * What the contact page shows: the office address, phone numbers, email
 * addresses, the WhatsApp Business number, business hours and the map's
 * position. A save is audited, and the page shows it at once, or within a
 * minute at worst. The header and footer still carry the details written
 * into the site (components/site.ts) until they are moved over.
 */

interface ContactView {
  settings: Settings;
  updatedAt: string | null;
  updatedBy: string | null;
  revalidated?: boolean;
}

interface Pair {
  a: string;
  b: string;
}

interface FormState {
  address: string;
  phones: Pair[];
  emails: Pair[];
  whatsapp: string;
  hours: Pair[];
  lat: string;
  lng: string;
}

function formFrom(settings: Settings): FormState {
  return {
    address: settings.addressLines.join('\n'),
    phones: settings.phones.map((phone) => ({ a: phone.label, b: phone.number })),
    emails: settings.emails.map((email) => ({ a: email.label, b: email.address })),
    whatsapp: settings.whatsapp ?? '',
    hours: settings.hours.map((entry) => ({ a: entry.days, b: entry.hours })),
    lat: settings.location ? String(settings.location.lat) : '',
    lng: settings.location ? String(settings.location.lng) : '',
  };
}

/** Rows with nothing typed in are dropped; a half-filled row is an error the reader can fix. */
function pairs(rows: Pair[], noun: string): Pair[] {
  const kept = rows.map((row) => ({ a: row.a.trim(), b: row.b.trim() })).filter((row) => row.a || row.b);
  if (kept.some((row) => !row.a || !row.b)) throw new ApiFailure(0, `Fill in both parts of every ${noun}, or remove it.`);
  if (kept.length === 0) throw new ApiFailure(0, `Give at least one ${noun}.`);
  return kept;
}

function payloadFrom(form: FormState): Settings {
  const addressLines = lines(form.address);
  if (addressLines.length === 0) throw new ApiFailure(0, 'Give the office address.');

  const lat = form.lat.trim();
  const lng = form.lng.trim();
  if (Boolean(lat) !== Boolean(lng)) {
    throw new ApiFailure(0, 'Give both the latitude and the longitude, or neither to hide the map.');
  }

  return {
    addressLines,
    phones: pairs(form.phones, 'phone number').map((row) => ({ label: row.a, number: row.b })),
    emails: pairs(form.emails, 'email address').map((row) => ({ label: row.a, address: row.b })),
    whatsapp: form.whatsapp.trim() || null,
    hours: pairs(form.hours, 'line of business hours').map((row) => ({ days: row.a, hours: row.b })),
    location: lat && lng ? { lat: Number(lat), lng: Number(lng) } : null,
  };
}

export default function ContactSettings() {
  const resource = useResource<ContactView>('/api/admin/settings/contact');
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  if (!resource.data) {
    return (
      <>
        <PageHeader label="Site" title="Contact details" />
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
            ? 'Saved. The contact page shows the change now.'
            : 'Saved. The contact page shows the change within a minute.',
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
  view: ContactView;
  notice: string | null;
  onSaved: (saved: ContactView) => void;
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

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = payloadFrom(form);
      setSaving(true);
      const saved = await api<ContactView>('/api/admin/settings/contact', { method: 'PUT', json: payload });
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader label="Site" title="Contact details">
        The office address, phone numbers, email addresses, WhatsApp number, hours and map on the
        contact page. The header and footer keep the details written into the site for now.{' '}
        <a className={linkText} href="/contact" target="_blank" rel="noopener noreferrer">
          Preview the contact page<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {view.updatedAt ? (
          <>
            {' · '}Last saved {formatDateTime(view.updatedAt)}
            {view.updatedBy ? ` by ${view.updatedBy}` : ''}
          </>
        ) : (
          ' · Showing the details as built; nothing has been saved yet.'
        )}
      </PageHeader>

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Office">
          <Field id="c-address" label="Address" hint="One line per line of the address, as it should be printed.">
            <textarea
              id="c-address"
              className={`${textarea} min-h-24`}
              required
              rows={4}
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
              aria-describedby="c-address-hint"
            />
          </Field>
          <PairList
            idPrefix="c-hours"
            noun="line of hours"
            labels={['Days', 'Hours']}
            placeholders={['Monday to Friday', '08:00–17:00 WAT']}
            max={7}
            value={form.hours}
            onChange={(value) => set('hours', value)}
          />
          <p className={muted}>
            Reads as: {form.hours.some((row) => row.a.trim() && row.b.trim())
              ? hoursText(form.hours.filter((row) => row.a.trim() && row.b.trim()).map((row) => ({ days: row.a.trim(), hours: row.b.trim() })))
              : '—'}
          </p>
        </FormSection>

        <FormSection title="Phone and WhatsApp">
          <PairList
            idPrefix="c-phone"
            noun="phone number"
            labels={['Label', 'Number']}
            placeholders={['Office', '+234 …']}
            types={['text', 'tel']}
            max={4}
            value={form.phones}
            onChange={(value) => set('phones', value)}
          />
          <Field
            id="c-whatsapp"
            label="WhatsApp Business number"
            optional
            hint="With the country code, such as +234 700 262 8458. Leave blank to hide WhatsApp."
          >
            <input
              id="c-whatsapp"
              className={input}
              type="tel"
              inputMode="tel"
              maxLength={20}
              value={form.whatsapp}
              onChange={(event) => set('whatsapp', event.target.value)}
              aria-describedby="c-whatsapp-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Email">
          <PairList
            idPrefix="c-email"
            noun="email address"
            labels={['Label', 'Address']}
            placeholders={['General enquiries', 'hello@…']}
            types={['text', 'email']}
            max={4}
            value={form.emails}
            onChange={(value) => set('emails', value)}
          />
        </FormSection>

        <FormSection title="Map">
          <p className="text-[0.875rem] leading-[1.7] text-zinc-600">
            The map under the address loads only when a visitor asks for it, from OpenStreetMap. It stays
            hidden until the office&rsquo;s position is set here: check the pin on openstreetmap.org first,
            because a pin in the wrong place sends visitors to the wrong building.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="c-lat" label="Latitude" optional hint="Such as 6.4281">
              <input
                id="c-lat"
                className={input}
                type="number"
                inputMode="decimal"
                step="any"
                min={-90}
                max={90}
                value={form.lat}
                onChange={(event) => set('lat', event.target.value)}
                aria-describedby="c-lat-hint"
              />
            </Field>
            <Field id="c-lng" label="Longitude" optional hint="Such as 3.4219">
              <input
                id="c-lng"
                className={input}
                type="number"
                inputMode="decimal"
                step="any"
                min={-180}
                max={180}
                value={form.lng}
                onChange={(event) => set('lng', event.target.value)}
                aria-describedby="c-lng-hint"
              />
            </Field>
          </div>
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

/** Rows of two labelled fields: a phone's label and number, an email's label and address, days and hours. */
function PairList({
  idPrefix,
  noun,
  labels,
  placeholders,
  types = ['text', 'text'],
  max,
  value,
  onChange,
}: {
  idPrefix: string;
  noun: string;
  labels: [string, string];
  placeholders: [string, string];
  types?: [string, string];
  max: number;
  value: Pair[];
  onChange: (value: Pair[]) => void;
}) {
  const update = (index: number, patch: Partial<Pair>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {value.map((row, index) => (
          <li
            key={index}
            className="grid grid-cols-1 gap-3 border border-zinc-300 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end"
          >
            {(['a', 'b'] as const).map((part, partIndex) => {
              const id = `${idPrefix}-${index}-${part}`;
              return (
                <div key={part} className="flex flex-col gap-1.75">
                  <label className={fieldLabel} htmlFor={id}>
                    {labels[partIndex]}
                    <span className="sr-only">, {noun} {index + 1}</span>
                  </label>
                  <input
                    id={id}
                    className={input}
                    type={types[partIndex]}
                    maxLength={partIndex === 0 ? 60 : types[partIndex] === 'tel' ? 20 : 255}
                    placeholder={placeholders[partIndex]}
                    value={row[part]}
                    onChange={(event) => update(index, { [part]: event.target.value })}
                  />
                </div>
              );
            })}
            <button
              className={btnSmall}
              type="button"
              disabled={value.length <= 1}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              Remove<span className="sr-only"> {noun} {index + 1}</span>
            </button>
          </li>
        ))}
      </ol>
      <div>
        <button
          className={btnSmall}
          type="button"
          disabled={value.length >= max}
          onClick={() => onChange([...value, { a: '', b: '' }])}
        >
          Add {/^[aeiou]/.test(noun) ? 'an' : 'a'} {noun}
        </button>
      </div>
    </div>
  );
}
