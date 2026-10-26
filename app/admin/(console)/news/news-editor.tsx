'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { serializeNewsForAdmin } from '@/lib/serializers';
import { ApiFailure, api } from '../../auth-client';
import { useSession } from '../console-shell';
import { PageHeader, StateBox, btnSmall, btnSmallDanger, btnSmallOrange, panel, useResource } from '../../kit';
import {
  CmsNotice,
  Field,
  FormSection,
  PublicationField,
  SaveBar,
  changedFields,
  input,
  orNull,
  publicationFrom,
  publishedAtFor,
  selectInput,
  textarea,
  useUnsavedChanges,
  type Publication,
} from '../../form-kit';
import { linkText, publicationText } from '../projects/project-list';
import { CATEGORY_LABELS, categoryLabel } from './news-list';

/**
 * Create and edit an article — `POST /api/news`, `PUT` and `DELETE
 * /api/news/[id]` (delete is admin-only). An update sends only the fields
 * that changed. The author is whoever creates the article.
 */

type Article = ReturnType<typeof serializeNewsForAdmin>;

interface FormState {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  featuredImageUrl: string;
  tags: string;
  metaTitle: string;
  metaDescription: string;
  publication: Publication;
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  category: 'update',
  excerpt: '',
  content: '',
  featuredImageUrl: '',
  tags: '',
  metaTitle: '',
  metaDescription: '',
  publication: { mode: 'draft', at: '' },
};

function formFrom(article: Article): FormState {
  return {
    title: article.title,
    slug: article.slug,
    category: article.category ?? '',
    excerpt: article.excerpt ?? '',
    content: article.content,
    featuredImageUrl: article.featuredImageUrl ?? '',
    tags: article.tags.join(', '),
    metaTitle: article.seo.metaTitle ?? '',
    metaDescription: article.seo.metaDescription ?? '',
    publication: publicationFrom(article.publishedAt),
  };
}

function payloadFrom(form: FormState, originalPublishedAt: string | null) {
  const tags = [...new Set(form.tags.split(',').map((tag) => tag.trim()).filter(Boolean))];
  if (tags.length > 20) throw new ApiFailure(0, 'An article can carry at most 20 tags.');

  return {
    title: form.title.trim(),
    // A slug cannot be cleared, only changed; blank on create derives one from the title.
    slug: form.slug.trim() ? form.slug.trim().toLowerCase() : undefined,
    category: form.category || null,
    excerpt: orNull(form.excerpt),
    content: form.content,
    featuredImageUrl: orNull(form.featuredImageUrl),
    tags,
    metaTitle: orNull(form.metaTitle),
    metaDescription: orNull(form.metaDescription),
    publishedAt: publishedAtFor(form.publication, originalPublishedAt),
  };
}

export default function NewsEditor({ articleId }: { articleId: string | null }) {
  const article = useResource<Article>(articleId ? `/api/news/${articleId}?includeUnpublished=true` : null);
  // Lives above the form, which remounts on save, so the confirmation survives it.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('created') === '1') {
      setNotice('Article created.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  if (articleId && !article.data) {
    return (
      <>
        <PageHeader label="News" title="Edit article" />
        <section className={panel} aria-busy={article.loading}>
          <StateBox loading={article.loading} error={article.error} onRetry={article.reload} />
        </section>
      </>
    );
  }

  return (
    <ArticleForm
      key={article.data?.updatedAt ?? 'new'}
      article={article.data}
      notice={notice}
      onSaved={(saved) => {
        setNotice('Changes saved.');
        // The PUT response carries no related articles; the editor never shows them.
        article.setData(() => saved);
      }}
    />
  );
}

function ArticleForm({
  article,
  notice,
  onSaved,
}: {
  article: Article | null;
  notice: string | null;
  onSaved: (saved: Article) => void;
}) {
  const router = useRouter();
  const { user, can } = useSession();
  const loaded = article ? formFrom(article) : EMPTY;
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
      const next = payloadFrom(form, article?.publishedAt ?? null);
      setSaving(true);

      if (!article) {
        const created = await api<Article>('/api/news', { method: 'POST', json: next });
        router.replace(`/admin/news/${created.id}?created=1`);
        return;
      }

      const changes = changedFields(payloadFrom(loaded, article.publishedAt), next);
      if (Object.keys(changes).length === 0) {
        setMessage({ text: 'Nothing has changed.', bad: false });
        setSaving(false);
        return;
      }

      const saved = await api<Article>(`/api/news/${article.id}`, { method: 'PUT', json: changes });
      onSaved(saved);
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  async function remove(): Promise<void> {
    if (!article) return;
    if (!window.confirm(`Delete “${article.title}”? It leaves the public site at once.`)) return;

    setSaving(true);
    try {
      await api<void>(`/api/news/${article.id}`, { method: 'DELETE' });
      router.replace('/admin/news');
    } catch (failure) {
      setMessage({ text: failure instanceof ApiFailure ? failure.message : 'No connection to the server.', bad: true });
      setSaving(false);
    }
  }

  const canDelete = user.role === 'admin' && can('news:delete');
  // A category set in the CMS that is not one of the standard three stays selectable.
  const categories =
    form.category && !(form.category in CATEGORY_LABELS)
      ? { ...CATEGORY_LABELS, [form.category]: categoryLabel(form.category) }
      : CATEGORY_LABELS;

  return (
    <>
      <PageHeader label="News" title={article ? article.title : 'New article'}>
        {article ? (
          <>
            {publicationText(article)} · {article.author ?? 'No author'}
            {article.isPublished ? (
              <>
                {' · '}
                <a className={linkText} href={`/news/${article.slug}`} target="_blank" rel="noopener noreferrer">
                  View on site
                </a>
              </>
            ) : null}
          </>
        ) : (
          'Saved as a draft unless you publish it below. You are recorded as the author.'
        )}
      </PageHeader>

      {article ? <CmsNotice cms={article.cms} /> : null}

      <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormSection title="Article">
          <Field id="n-title" label="Headline">
            <input
              id="n-title"
              className={input}
              required
              minLength={3}
              maxLength={255}
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </Field>
          <Field
            id="n-slug"
            label="Web address"
            optional={!article}
            hint={article ? 'Changing it breaks links already shared to the old address.' : 'Made from the headline if left blank.'}
          >
            <input
              id="n-slug"
              className={input}
              required={Boolean(article)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              maxLength={255}
              value={form.slug}
              onChange={(event) => set('slug', event.target.value)}
              aria-describedby="n-slug-hint"
            />
          </Field>
          <Field id="n-category" label="Category">
            <select
              id="n-category"
              className={selectInput}
              value={form.category}
              onChange={(event) => set('category', event.target.value)}
            >
              <option value="">None</option>
              {Object.entries(categories).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="n-excerpt" label="Standfirst" optional hint={`Shown on news cards. ${form.excerpt.length} of 300 characters.`}>
            <textarea
              id="n-excerpt"
              className={`${textarea} min-h-20`}
              maxLength={300}
              value={form.excerpt}
              onChange={(event) => set('excerpt', event.target.value)}
              aria-describedby="n-excerpt-hint"
            />
          </Field>
          <Field
            id="n-content"
            label="Body"
            hint="Separate paragraphs with a blank line. “## ” starts a heading, “- ” a list item and “> ” a quote. Bold and links are not shown."
          >
            <textarea
              id="n-content"
              className={`${textarea} min-h-96 leading-[1.7]`}
              required
              maxLength={200_000}
              value={form.content}
              onChange={(event) => set('content', event.target.value)}
              aria-describedby="n-content-hint"
            />
          </Field>
          <Field id="n-image" label="Featured image" optional>
            <input
              id="n-image"
              className={input}
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={512}
              value={form.featuredImageUrl}
              onChange={(event) => set('featuredImageUrl', event.target.value)}
            />
          </Field>
          <Field id="n-tags" label="Tags" optional hint="Separated by commas, up to 20.">
            <input
              id="n-tags"
              className={input}
              value={form.tags}
              onChange={(event) => set('tags', event.target.value)}
              aria-describedby="n-tags-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Search and sharing">
          <Field id="n-meta-title" label="Page title" optional hint="Defaults to the headline.">
            <input
              id="n-meta-title"
              className={input}
              maxLength={255}
              value={form.metaTitle}
              onChange={(event) => set('metaTitle', event.target.value)}
              aria-describedby="n-meta-title-hint"
            />
          </Field>
          <Field id="n-meta-description" label="Search description" optional hint={`${form.metaDescription.length} of 160 characters.`}>
            <textarea
              id="n-meta-description"
              className={`${textarea} min-h-20`}
              maxLength={160}
              value={form.metaDescription}
              onChange={(event) => set('metaDescription', event.target.value)}
              aria-describedby="n-meta-description-hint"
            />
          </Field>
        </FormSection>

        <FormSection title="Publication">
          <PublicationField
            idPrefix="n"
            value={form.publication}
            original={article?.publishedAt ?? null}
            onChange={(next) => set('publication', next)}
          />
        </FormSection>

        <SaveBar message={message}>
          <button className={btnSmallOrange} type="submit" disabled={saving || (Boolean(article) && !dirty)}>
            {saving ? 'Saving…' : article ? 'Save changes' : 'Create article'}
          </button>
          {article && dirty ? (
            <button className={btnSmall} type="button" disabled={saving} onClick={() => setForm(loaded)}>
              Discard changes
            </button>
          ) : null}
          {!article ? (
            <Link className={btnSmall} href="/admin/news">
              Cancel
            </Link>
          ) : null}
          {article && canDelete ? (
            <button className={`${btnSmallDanger} ml-auto`} type="button" disabled={saving} onClick={() => void remove()}>
              Delete article
            </button>
          ) : null}
        </SaveBar>
      </form>
    </>
  );
}
