'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AnalyticsSummary } from '@/lib/repositories/analytics';
import { useSession } from './console-shell';
import {
  PageHeader,
  StateBox,
  filterSelect,
  formatNumber,
  muted,
  panel,
  panelHead,
  panelTitle,
  td,
  th,
  useResource,
} from '../kit';

/** `GET /api/admin/analytics`: the summary plus the two blocks the route adds. */
interface Analytics extends AnalyticsSummary {
  usersByRole: Array<{ role: string; count: number }>;
  content: { publishedProjects: number; publishedNews: number; publishedTours: number };
}

const PERIODS = ['7', '30', '90'] as const;

const FORM_LABELS: Record<string, string> = {
  inquiry: 'Enquiries',
  investment: 'Investment interest',
  newsletter: 'Newsletter sign-ups',
};

export default function Overview() {
  const { user, can } = useSession();
  const greeting = `Signed in as ${user.fullName}`;

  if (!can('analytics:read')) {
    return (
      <>
        <PageHeader label="Overview" title="Admin console">
          {greeting}. Site analytics are limited to administrators and viewers; the sections your
          role can use are in the menu.
        </PageHeader>
        <ul className="flex flex-col gap-2">
          {can('forms:read') ? (
            <li>
              <Link className="text-[0.938rem] text-rust underline hover:text-rust-hover" href="/admin/submissions">
                Review form submissions
              </Link>
            </li>
          ) : null}
        </ul>
      </>
    );
  }

  return <AnalyticsView greeting={greeting} />;
}

function AnalyticsView({ greeting }: { greeting: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('30');
  const { data, error, loading, reload } = useResource<Analytics>(
    `/api/admin/analytics?period=${period}`,
  );

  const submissionsTotal = data?.submissions.reduce((sum, row) => sum + row.count, 0) ?? 0;

  return (
    <>
      <PageHeader label="Overview" title="Site at a glance">
        {greeting}. Page views are deleted after the retention window (30 days unless configured
        otherwise), so a longer period cannot show traffic older than that.
      </PageHeader>

      <div className="mb-5 flex items-center gap-3">
        <label className="text-[0.813rem] text-zinc-700" htmlFor="overview-period">
          Period
        </label>
        <select
          id="overview-period"
          className={filterSelect}
          value={period}
          onChange={(event) => setPeriod(event.target.value as (typeof PERIODS)[number])}
        >
          {PERIODS.map((days) => (
            <option key={days} value={days}>
              Last {days} days
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <div className={panel}>
          <StateBox loading={loading} error={error} onRetry={reload} />
        </div>
      ) : (
        <div className={`flex flex-col gap-5 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <dl className="grid grid-cols-2 gap-px border border-zinc-300 bg-zinc-300 lg:grid-cols-4">
            <Stat label="Page views" value={data.totalViews} />
            <Stat label="Sessions" value={data.uniqueSessions} />
            <Stat label="Submissions" value={submissionsTotal} note="Spam excluded" />
            <Stat label="Newsletter" value={data.newsletterSubscribers} note="Confirmed, all time" />
          </dl>

          <ViewsByDay rows={data.viewsByDay} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <RankTable
              title="Top pages"
              head="Path"
              rows={data.topPages.map((r) => ({ key: r.path, label: r.path, value: r.views }))}
              empty="No page views in this period."
            />
            <RankTable
              title="Top referrers"
              head="Referrer"
              rows={data.topReferrers.map((r) => ({ key: r.referrer, label: r.referrer, value: r.views }))}
              empty="No referred visits in this period."
            />
            <RankTable
              title="Submissions by form"
              head="Form"
              rows={data.submissions.map((r) => ({
                key: r.formType,
                label: FORM_LABELS[r.formType] ?? r.formType,
                value: r.count,
              }))}
              empty="No submissions in this period."
            />
            <div className={panel}>
              <div className={panelHead}>
                <h2 className={panelTitle}>Published content</h2>
              </div>
              <dl className="grid grid-cols-3 gap-4 px-5 py-5">
                <MiniStat label="Projects" value={data.content.publishedProjects} />
                <MiniStat label="Articles" value={data.content.publishedNews} />
                <MiniStat label="Tours" value={data.content.publishedTours} />
              </dl>
              <div className="border-t border-line px-5 py-4">
                <p className="text-[0.688rem] font-semibold tracking-[0.12em] text-zinc-600 uppercase">
                  Accounts by role
                </p>
                <p className="mt-1.5 text-[0.875rem] text-zinc-700">
                  {data.usersByRole.length
                    ? data.usersByRole.map((r) => `${r.role} ${formatNumber(r.count)}`).join(' · ')
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5 bg-white px-5 py-5">
      <dt className="text-[0.688rem] font-semibold tracking-[0.12em] text-zinc-600 uppercase">{label}</dt>
      <dd className="text-[1.875rem] leading-none font-light tracking-[-0.03em] text-ink tabular-nums">
        {formatNumber(value)}
      </dd>
      {note ? <dd className="text-[0.719rem] text-zinc-600">{note}</dd> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[0.688rem] font-semibold tracking-[0.12em] text-zinc-600 uppercase">{label}</dt>
      <dd className="text-[1.375rem] font-light text-ink tabular-nums">{formatNumber(value)}</dd>
    </div>
  );
}

/**
 * Daily views as plain bars. Ink rather than orange: orange as a meaningful
 * fill on white fails the 3:1 non-text contrast rule the site holds to.
 */
function ViewsByDay({ rows }: { rows: Array<{ date: string; views: number }> }) {
  const peak = Math.max(1, ...rows.map((r) => r.views));

  return (
    <section className={panel}>
      <div className={panelHead}>
        <h2 className={panelTitle}>Views by day</h2>
        {rows.length ? <p className={muted}>Peak {formatNumber(peak)}</p> : null}
      </div>
      {rows.length === 0 ? (
        <p className={`px-5 py-8 ${muted}`}>No page views in this period.</p>
      ) : (
        <div className="flex h-40 items-end gap-px px-5 pt-5 pb-3" role="img" aria-label={`Daily page views, peak ${peak}`}>
          {rows.map((row) => (
            <div
              key={row.date}
              className="min-w-0 flex-1 bg-ink hover:bg-rust"
              style={{ height: `${Math.max(2, (row.views / peak) * 100)}%` }}
              title={`${row.date}: ${formatNumber(row.views)} views`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RankTable({
  title,
  head,
  rows,
  empty,
}: {
  title: string;
  head: string;
  rows: Array<{ key: string; label: string; value: number }>;
  empty: string;
}) {
  return (
    <section className={panel}>
      <div className={panelHead}>
        <h2 className={panelTitle}>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className={`px-5 py-8 ${muted}`}>{empty}</p>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className={th} scope="col">
                {head}
              </th>
              <th className={`${th} w-24 text-right`} scope="col">
                Views
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row) => (
              <tr key={row.key}>
                <td className={`${td} truncate`} title={row.label}>
                  {row.label}
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatNumber(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
