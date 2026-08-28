import { query, queryOne } from '../db';
import { env } from '../env';
import { truncateIp } from '../privacy';

/** First-party page-view analytics for the admin dashboard (§3). */

export async function recordPageView(input: {
  pagePath: string;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  userId?: string | null;
  sessionId?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO page_views (user_id, session_id, page_path, referrer, user_agent, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      input.userId ?? null,
      input.sessionId ?? null,
      input.pagePath.slice(0, 512),
      input.referrer?.slice(0, 512) ?? null,
      input.userAgent ?? null,
      truncateIp(input.ipAddress),
    ],
  );
}

export interface AnalyticsSummary {
  periodDays: number;
  totalViews: number;
  uniqueSessions: number;
  topPages: Array<{ path: string; views: number }>;
  viewsByDay: Array<{ date: string; views: number }>;
  topReferrers: Array<{ referrer: string; views: number }>;
  submissions: Array<{ formType: string; count: number }>;
  newsletterSubscribers: number;
}

export async function summary(periodDays: 7 | 30 | 90 = 30): Promise<AnalyticsSummary> {
  const since = `NOW() - ($1 || ' days')::interval`;

  const [totals, topPages, byDay, referrers, submissions, subscribers] = await Promise.all([
    queryOne<{ total: string; sessions: string }>(
      `SELECT count(*)::text AS total, count(DISTINCT session_id)::text AS sessions
         FROM page_views WHERE viewed_at >= ${since}`,
      [periodDays],
    ),
    query<{ path: string; views: string }>(
      `SELECT page_path AS path, count(*)::text AS views
         FROM page_views WHERE viewed_at >= ${since}
        GROUP BY page_path ORDER BY count(*) DESC LIMIT 20`,
      [periodDays],
    ),
    query<{ date: string; views: string }>(
      `SELECT to_char(date_trunc('day', viewed_at), 'YYYY-MM-DD') AS date, count(*)::text AS views
         FROM page_views WHERE viewed_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      [periodDays],
    ),
    query<{ referrer: string; views: string }>(
      `SELECT referrer, count(*)::text AS views
         FROM page_views
        WHERE viewed_at >= ${since} AND referrer IS NOT NULL AND referrer <> ''
        GROUP BY referrer ORDER BY count(*) DESC LIMIT 10`,
      [periodDays],
    ),
    query<{ form_type: string; count: string }>(
      `SELECT form_type, count(*)::text AS count
         FROM form_submissions
        WHERE submitted_at >= ${since} AND flagged_as_spam = FALSE
        GROUP BY form_type`,
      [periodDays],
    ),
    queryOne<{ count: string }>(
      `SELECT count(*)::text AS count FROM newsletter_subscribers
        WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`,
    ),
  ]);

  return {
    periodDays,
    totalViews: Number(totals?.total ?? 0),
    uniqueSessions: Number(totals?.sessions ?? 0),
    topPages: topPages.rows.map((r) => ({ path: r.path, views: Number(r.views) })),
    viewsByDay: byDay.rows.map((r) => ({ date: r.date, views: Number(r.views) })),
    topReferrers: referrers.rows.map((r) => ({ referrer: r.referrer, views: Number(r.views) })),
    submissions: submissions.rows.map((r) => ({
      formType: r.form_type,
      count: Number(r.count),
    })),
    newsletterSubscribers: Number(subscribers?.count ?? 0),
  };
}

/** Drops page views past the 30-day retention window (§11). */
export async function purgeExpiredPageViews(): Promise<number> {
  const { rowCount } = await query(
    `DELETE FROM page_views WHERE viewed_at < NOW() - ($1 || ' days')::interval`,
    [env.RETENTION_PAGE_VIEW_DAYS],
  );
  return rowCount;
}
