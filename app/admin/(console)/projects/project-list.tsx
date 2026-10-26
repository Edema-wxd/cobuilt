'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { serializeProjectForAdmin } from '@/lib/serializers';
import { useSession } from '../console-shell';
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

/**
 * Every project, drafts and scheduled ones included — `GET /api/projects`
 * with `includeUnpublished`, which returns the admin view to staff.
 */

export type AdminProject = ReturnType<typeof serializeProjectForAdmin>;

export const STATUS_LABELS: Record<AdminProject['status'], string> = {
  future: 'Future',
  ongoing: 'Ongoing',
  completed: 'Completed',
};

export function publicationText(item: { isPublished: boolean; publishedAt: string | null }): string {
  if (item.isPublished) return 'Published';
  return item.publishedAt ? `Scheduled ${formatDateTime(item.publishedAt)}` : 'Draft';
}

export const linkText = 'text-rust underline underline-offset-2 hover:text-rust-hover';

export default function ProjectList() {
  const { can } = useSession();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useResource<Page<AdminProject>>(
    withQuery('/api/projects', { includeUnpublished: 'true', q, status, page, pageSize: 25 }),
  );

  return (
    <>
      <PageHeader label="Projects" title="Projects">
        Drafts and scheduled projects are listed here but not on the public site. Investment figures
        stay hidden until they are approved.
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
          <label className="sr-only" htmlFor="projects-search">
            Search projects
          </label>
          <input
            id="projects-search"
            className={filterInput}
            type="search"
            placeholder="Search projects"
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className={btnSmall} type="submit">
            Search
          </button>
          <label className="sr-only" htmlFor="projects-status">
            Status
          </label>
          <select
            id="projects-status"
            className={filterSelect}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </form>

        <Link className={btnSmallOrange} href="/admin/projects/new">
          New project
        </Link>
      </div>

      <section className={panel} aria-busy={list.loading}>
        {!list.data || list.data.results.length === 0 ? (
          <StateBox
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            empty={q || status ? 'No projects match.' : 'There are no projects yet.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl border-collapse">
                <thead>
                  <tr>
                    <th className={th} scope="col">Project</th>
                    <th className={th} scope="col">Status</th>
                    <th className={th} scope="col">Publication</th>
                    <th className={th} scope="col">Passport</th>
                    <th className={th} scope="col">Investor figures</th>
                    <th className={th} scope="col">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.results.map((project) => (
                    <tr key={project.id}>
                      <td className={`${td} max-w-xs`}>
                        <Link className="font-semibold text-ink hover:text-rust" href={`/admin/projects/${project.id}`}>
                          {project.title}
                        </Link>
                        <span className={`block break-all ${muted}`}>/{project.slug}</span>
                        {project.cms ? <span className={`block ${muted}`}>From the CMS</span> : null}
                      </td>
                      <td className={td}>{STATUS_LABELS[project.status]}</td>
                      <td className={td}>
                        <span className={project.isPublished ? 'text-msg-ok' : 'text-zinc-700'}>
                          {publicationText(project)}
                        </span>
                      </td>
                      <td className={td}>
                        {project.passport.enabled ? 'On' : <span className={muted}>Off</span>}
                        {can('passport:write') ? (
                          <Link className={`block text-[0.813rem] ${linkText}`} href={`/admin/projects/${project.id}/passport`}>
                            Milestones
                          </Link>
                        ) : null}
                      </td>
                      <td className={td}>
                        <InvestorState project={project} />
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatDateTime(project.updatedAt)}</td>
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

function InvestorState({ project }: { project: AdminProject }) {
  const { investor } = project;
  const hasFigures =
    investor.investmentAmount !== null || investor.expectedRoi !== null || investor.highlights !== null;
  if (!hasFigures) return <span className={muted}>None</span>;
  return investor.approved ? (
    <span className="text-msg-ok">Approved</span>
  ) : (
    <span className="text-zinc-700">Awaiting approval</span>
  );
}
