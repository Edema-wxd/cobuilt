'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { serializeNewsSummaryForAdmin } from '@/lib/serializers';
import {
  PageHeader,
  Pager,
  StateBox,
  btnSmall,
  btnSmallOrange,
  filterInput,
  filterSelect,
  formatDateTime,
  muted,
  panel,
  td,
  th,
  useResource,
  withQuery,
  type Page,
} from '../../kit';
import { publicationText } from '../projects/project-list';

/**
 * Every article, drafts and scheduled ones included — `GET /api/news` with
 * `includeUnpublished`, which returns the admin view to staff.
 */

type ArticleSummary = ReturnType<typeof serializeNewsSummaryForAdmin>;

/** The categories the public news filter is built around (schemas/news.ts). */
export const CATEGORY_LABELS: Record<string, string> = {
  press_release: 'Press release',
  update: 'Update',
  announcement: 'Announcement',
};

export function categoryLabel(value: string | null): string {
  if (!value) return '—';
  return CATEGORY_LABELS[value] ?? value.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export default function NewsList() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const list = useResource<Page<ArticleSummary>>(
    withQuery('/api/news', { includeUnpublished: 'true', q, category, page, pageSize: 25 }),
  );

  return (
    <>
      <PageHeader label="News" title="News and insights">
        Drafts and scheduled articles are listed here but not on the public site.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(search.trim());
            setPage(1);
          }}
        >
          <label className="sr-only" htmlFor="news-search">
            Search articles
          </label>
          <input
            id="news-search"
            className={filterInput}
            type="search"
            placeholder="Search articles"
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className={btnSmall} type="submit">
            Search
          </button>
          <label className="sr-only" htmlFor="news-category">
            Category
          </label>
          <select
            id="news-category"
            className={filterSelect}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </form>

        <Link className={btnSmallOrange} href="/admin/news/new">
          New article
        </Link>
      </div>

      <section className={panel} aria-busy={list.loading}>
        {!list.data || list.data.results.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty={q || category ? 'No articles match.' : 'There are no articles yet.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-2xl border-collapse">
                <thead>
                  <tr>
                    <th className={th} scope="col">Article</th>
                    <th className={th} scope="col">Category</th>
                    <th className={th} scope="col">Publication</th>
                    <th className={th} scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.results.map((article) => (
                    <tr key={article.id}>
                      <td className={`${td} max-w-sm`}>
                        <Link className="font-semibold text-ink hover:text-rust" href={`/admin/news/${article.id}`}>
                          {article.title}
                        </Link>
                        <span className={`block ${muted}`}>
                          {article.author ?? 'No author'}
                          {article.cms ? ' · From the CMS' : ''}
                        </span>
                      </td>
                      <td className={td}>{categoryLabel(article.category)}</td>
                      <td className={td}>
                        <span className={article.isPublished ? 'text-msg-ok' : 'text-zinc-700'}>
                          {publicationText(article)}
                        </span>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatDateTime(article.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager pagination={list.data.pagination} onPage={setPage} />
          </>
        )}
      </section>
    </>
  );
}
