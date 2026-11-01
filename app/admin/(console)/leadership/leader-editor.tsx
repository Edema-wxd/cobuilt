'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LeadershipTier } from '@/types/models';
import { ApiFailure, api } from '../../auth-client';
import { useSession } from '../console-shell';
import { PageHeader, StateBox, btnSmall, btnSmallDanger, btnSmallOrange, muted, panel, useResource } from '../../kit';
import {
  CmsNotice,
  Field,
  FormSection,
  SaveBar,
  changedFields,
  checkbox,
  checkboxRow,
  input,
  lines,
  orNull,
  selectInput,
  textarea,
  useUnsavedChanges,
} from '../../form-kit';
import { SOCIAL_LABEL, TIER_LABEL, TIER_ORDER } from '../../../leadership/leadership-shared';
import { linkText } from '../projects/project-list';
import type { AdminLeader } from './leadership-list';

/**
 * Create and edit a leadership profile — `POST /api/admin/leadership`,
 * `PATCH` and `DELETE /api/admin/leadership/[id]` (delete is admin-only). An
 * update sends only the fields that changed, so the audit log's field list is
 * truthful.
 *
 * The photograph is an https URL, as for project and news images: the only
 * UploadThing route is the tour-model one, which accepts 3D files only.
 */

type Network = keyof typeof SOCIAL_LABEL;
const NETWORKS = Object.keys(SOCIAL_LABEL) as Network[];

interface FormState {
  fullName: string;
  roleTitle: string;
  slug: string;
  tier: LeadershipTier;
  summary: string;
  quote: string;
  bio: string;
  qualifications: string;
  expertise: string;
  photoUrl: string;
  photoAlt: string;
  social: Record<Network, string>;
  published: boolean;
  featured: boolean;
}

const EMPTY: FormState = {
  fullName: '',
  roleTitle: '',
  slug: '',
  tier: 'executive',
  summary: '',
  quote: '',
  bio: '',
  qualifications: '',
  expertise: '',
  photoUrl: '',
  photoAlt: '',
  social: { linkedin: '', x: '', website: '' },
  published: false,
  featured: false,
};

function formFrom(leader: AdminLeader): FormState {
  return {
    fullName: leader.fullName,
    roleTitle: leader.roleTitle ?? '',
    slug: leader.slug,
    tier: leader.tier,
    summary: leader.summary ?? '',
    quote: leader.quote ?? '',
    bio: leader.bio ?? '',
    qualifications: leader.qualifications.join('\n'),
    expertise: leader.expertise.join('\n'),
    photoUrl: leader.photoUrl ?? '',
    photoAlt: leader.photoAlt ?? '',
    social: {
      linkedin: leader.socialLinks.linkedin ?? '',
      x: leader.socialLinks.x ?? '',
      website: leader.socialLinks.website ?? '',
    },
    published: leader.published,
    featured: leader.featured,
  };
}

const HTTPS = /^https:\/\/\S+$/i;

function entries(value: string, label: string): string[] {
  const items = [...new Set(lines(value))];
  if (items.length > 20) throw new ApiFailure(0, `${label}: at most 20 entries.`);
  const long = items.find((item) => item.length > 200);
  if (long) throw new ApiFailure(0, `${label}: each entry is at most 200 characters.`);
  return items;
}

function payloadFrom(form: FormState) {
  const photoUrl = orNull(form.photoUrl);
  if (photoUrl && !HTTPS.test(photoUrl)) throw new ApiFailure(0, 'The photograph must be an https:// address.');

  const socialLinks: Partial<Record<Network, string>> = {};
  for (const network of NETWORKS) {
    const url = form.social[network].trim();
    if (!url) continue;
    if (!HTTPS.test(url)) throw new ApiFailure(0, `${SOCIAL_LABEL[network]} must be an https:// address.`);
    socialLinks[network] = url;
  }

  return {
    fullName: form.fullName.trim(),
    roleTitle: form.roleTitle.trim(),
    // A web address cannot be cleared, only changed; blank on create derives one from the name.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    tier: form.tier,
    summary: orNull(form.summary),
    quote: orNull(form.quote),
    bio: orNull(form.bio),
    qualifications: entries(form.qualifications, 'Qualifications'),
    expertise: entries(form.expertise, 'Areas of expertise'),
    photoUrl,
    photoAlt: orNull(form.photoAlt),
    socialLinks,
    published: form.published,
    featured: form.featured,
  };
}

export default function LeaderEditor({ leaderId }: { leaderId: string | null }) {
  const leader = useResource<AdminLeader>(leaderId ? `/api/admin/leadership/${leaderId}` : null);
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Profile created.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (leaderId && !leader.data) {
    return (
      <>
        <PageHeader label="Leadership" title="Edit profile" />
        <section className={panel} aria-busy={leader.loading}>
          <StateBox loading={leader.loading} error={leader.error} onRetry={leader.reload} />
        </section>
      </>
    );
  }

  return (
    <LeaderForm
      key={leader.data?.updatedAt ?? 'new'}
      leader={leader.data}
      notice={notice}
      onSaved={(saved) => {
        setNotice('Changes saved.');
        leader.setData(() => saved);
      }}
    />
  );
}

function LeaderForm({
  leader,
  notice,
  onSaved,
}: {
  leader: AdminLeader | null;
  notice: string | null;
  onSaved: (saved: AdminLeader) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = leader ? formFrom(leader) : EMPTY;
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

      if (!leader) {
        const created = await api<AdminLeader>('/api/admin/leadership', { method: 'POST', json: next });
        router.replace(`/admin/leadership/${created.id}?created=1`);
        return;
      }

      const changes = changedFields(payloadFrom(loaded), next);
      if (Object.keys(changes).length === 0) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        setSaving(false);
        return;
      }

      const saved = await api<AdminLeader>(`/api/admin/leadership/${leader.id}`, { method: 'PATCH', json: changes });
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!leader) return;
    if (!window.confirm(`Delete the profile of ${leader.fullName}? It leaves the public site at once.`)) return;

    setSaving(true);
    try {
      await api<void>(`/api/admin/leadership/${leader.id}`, { method: 'DELETE' });
      router.replace('/admin/leadership');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  const canDelete = user.role === 'admin' && can('leadership:write');
  const preview = HTTPS.test(form.photoUrl.trim()) ? form.photoUrl.trim() : null;

  return (
    <>
      <PageHeader label="Leadership" title={leader ? leader.fullName : 'New profile'}>
        {leader ? (
          <>
            {leader.published ? 'Published' : 'Draft'}
            {leader.featured ? ' · In the homepage spotlight' : ''}
            {leader.published ? (
              <>
                {' · '}
                <a className={linkText} href={`/leadership/${leader.slug}`} target="_blank" rel="noopener noreferrer">
                  View on site
                </a>
              </>
            ) : null}
          </>
        ) : (
          'Saved as a draft unless you publish it below. New profiles go to the end of the running order.'
        )}
      </PageHeader>

      {leader ? <CmsNotice cms={leader.cms} /> : null}

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Executive profile">
          <Field id="l-name" label="Full name">
            <input
              id="l-name"
              className={input}
              required
              minLength={2}
              maxLength={255}
              autoComplete="off"
              value={form.fullName}
              onChange={(event) => set('fullName', event.target.value)}
            />
          </Field>
          <Field id="l-role" label="Role">
            <input
              id="l-role"
              className={input}
              required
              minLength={2}
              maxLength={255}
              placeholder="e.g. Managing Director"
              value={form.roleTitle}
              onChange={(event) => set('roleTitle', event.target.value)}
            />
          </Field>
          <Field
            id="l-slug"
            label="Web address"
            optional={!leader}
            hint={leader ? 'Changing it breaks links already shared to the old address.' : 'Made from the name if left blank.'}
          >
            <input
              id="l-slug"
              className={input}
              required={Boolean(leader)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="l-slug-hint"
            />
          </Field>
          <Field id="l-tier" label="Organisational structure" hint="The tier the leadership page lists this person under.">
            <select
              id="l-tier"
              className={selectInput}
              value={form.tier}
              onChange={(event) => set('tier', event.target.value as LeadershipTier)}
              aria-describedby="l-tier-hint"
            >
              {TIER_ORDER.map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_LABEL[tier]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="l-summary"
            label="Short profile"
            optional
            hint={`One or two sentences for the profile card and the homepage spotlight. ${form.summary.length} of 300 characters.`}
          >
            <textarea
              id="l-summary"
              className={`${textarea} min-h-20`}
              maxLength={300}
              value={form.summary}
              onChange={(event) => set('summary', event.target.value)}
              aria-describedby="l-summary-hint"
            />
          </Field>
          <Field id="l-quote" label="Quote" optional hint={`Shown in italics, without quotation marks. ${form.quote.length} of 300 characters.`}>
            <textarea
              id="l-quote"
              className={`${textarea} min-h-20`}
              maxLength={300}
              value={form.quote}
              onChange={(event) => set('quote', event.target.value)}
              aria-describedby="l-quote-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Professional biography">
          <Field id="l-bio" label="Biography" optional hint="Separate paragraphs with a blank line.">
            <textarea
              id="l-bio"
              className={`${textarea} min-h-72 leading-[1.7]`}
              maxLength={20_000}
              value={form.bio}
              onChange={(event) => set('bio', event.target.value)}
              aria-describedby="l-bio-hint"
            />
          </Field>
          <Field id="l-qualifications" label="Qualifications" optional hint="One per line: degrees, professional memberships, certifications. Up to 20.">
            <textarea
              id="l-qualifications"
              className={textarea}
              value={form.qualifications}
              onChange={(event) => set('qualifications', event.target.value)}
              aria-describedby="l-qualifications-hint"
            />
          </Field>
          <Field id="l-expertise" label="Areas of expertise" optional hint="One per line. Up to 20.">
            <textarea
              id="l-expertise"
              className={textarea}
              value={form.expertise}
              onChange={(event) => set('expertise', event.target.value)}
              aria-describedby="l-expertise-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Photograph">
          <Field
            id="l-photo"
            label="Portrait"
            optional
            hint="An https:// address of an approved photograph. Without one, the page says the portrait is awaited."
          >
            <input
              id="l-photo"
              className={input}
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={512}
              value={form.photoUrl}
              onChange={(event) => set('photoUrl', event.target.value)}
              aria-describedby="l-photo-hint"
            />
          </Field>
          {preview ? (
            <div className="h-48 w-38 overflow-hidden border border-zinc-300 bg-line">
              {/* A preview of what the page will show; empty alt because the field above names it. */}
              <img className="size-full object-cover object-top" src={preview} alt="" />
            </div>
          ) : null}
          <Field
            id="l-photo-alt"
            label="Portrait description"
            optional
            hint="Read out by screen readers. Defaults to “Portrait of” and the name."
          >
            <input
              id="l-photo-alt"
              className={input}
              maxLength={255}
              value={form.photoAlt}
              onChange={(event) => set('photoAlt', event.target.value)}
              aria-describedby="l-photo-alt-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Profiles elsewhere">
          {NETWORKS.map((network) => (
            <Field key={network} id={`l-social-${network}`} label={SOCIAL_LABEL[network]} optional>
              <input
                id={`l-social-${network}`}
                className={input}
                type="url"
                inputMode="url"
                placeholder="https://"
                maxLength={512}
                value={form.social[network]}
                onChange={(event) => set('social', { ...form.social, [network]: event.target.value })}
              />
            </Field>
          ))}
        </FormSection>

        <FormSection title="Publication">
          <label className={`${checkboxRow} items-start py-1`}>
            <input
              className={`${checkbox} mt-0.5`}
              type="checkbox"
              checked={form.published}
              onChange={(event) => set('published', event.target.checked)}
            />
            <span>
              Published
              <span className={`block ${muted}`}>On the leadership page within a minute of saving.</span>
            </span>
          </label>
          <label className={`${checkboxRow} items-start py-1`}>
            <input
              className={`${checkbox} mt-0.5`}
              type="checkbox"
              checked={form.featured}
              onChange={(event) => set('featured', event.target.checked)}
            />
            <span>
              Homepage spotlight
              <span className={`block ${muted}`}>Also shown on the homepage, once published.</span>
            </span>
          </label>
        </FormSection>

        <SaveBar message={message}>
          <button className={btnSmallOrange} type="submit" disabled={saving || (Boolean(leader) && !dirty)}>
            {saving ? 'Saving…' : leader ? 'Save changes' : 'Create profile'}
          </button>
          {leader && dirty ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
          {!leader ? (
            <Link className={btnSmall} href="/admin/leadership">
              Cancel
            </Link>
          ) : null}
          {leader && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={saving} onClick={() => void remove()}>
              Delete profile
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}
