# Operations runbook

Procedures for running the CoBuilt backend in production. Assumes the topology
in [`deployment.md`](deployment.md).

## First response

```bash
curl -s https://cobuilt.com/api/health | jq        # which dependency is down
pm2 status                                         # are the processes up
pm2 logs cobuilt-web --lines 100
```

`/api/health` names the failing dependency, and the app degrades rather than
failing for everything except PostgreSQL. Start there.

Every response carries an `X-Request-Id`. When a user reports an error, ask for
it — it appears in the error body and in the log line for that request.

---

## Incidents

### The site is down

1. `curl -i https://cobuilt.com/api/health`
   - **503, `database: false`** → PostgreSQL. Go to [Database unreachable](#database-unreachable).
   - **502/504** → no app server is answering. `pm2 status`, then
     `pm2 restart cobuilt-web`.
   - **No response at all** → check Cloudflare status and the origin firewall
     before touching the application.
2. If one app server is bad, take it out of the Nginx upstream and restart it
   rather than debugging under load.

### Database unreachable

```bash
psql "$DATABASE_URL" -c 'SELECT 1'
sudo systemctl status postgresql
psql "$DATABASE_URL" -c 'SELECT count(*) FROM pg_stat_activity'
```

Connection exhaustion is the usual cause. Each app server opens up to
`DATABASE_POOL_MAX` (default 10), so two web servers plus a worker need ~30
connections; PostgreSQL's default `max_connections` is 100.

Find and end what is stuck:

```sql
SELECT pid, state, wait_event_type, now() - query_start AS duration,
       left(query, 120) AS query
  FROM pg_stat_activity
 WHERE state <> 'idle' AND now() - query_start > interval '30 seconds'
 ORDER BY duration DESC;

SELECT pg_terminate_backend(<pid>);
```

### Redis is down

The site stays up: caching misses through to PostgreSQL and rate limiting is
bypassed (Cloudflare's edge limits still apply). Expect higher database load.

Restore Redis, then confirm `"redis": true` on `/api/health`. Cache and job
queues both live there — restarting Redis loses queued jobs, so check for
enqueued email that never sent afterwards.

### Search is failing

Responses report `"engine": "postgres"` when the fallback is in use, so users
keep getting results. Restore Meilisearch, then:

```bash
npm run search:reindex
```

### Emails are not arriving

1. `pm2 logs cobuilt-worker` — is the worker running at all?
2. Check the failed-job count:

```bash
node -e "const {Queue}=require('bullmq');const q=new Queue('email',{connection:{url:process.env.REDIS_URL}});q.getJobCounts().then(c=>{console.log(c);process.exit(0)})"
```

Jobs retry five times with exponential backoff. Failures are kept seven days, so
a job that exhausted its attempts is still inspectable. The submission itself is
committed to PostgreSQL before any email is queued — a mail outage never loses
an enquiry, and `form_submissions` is the record to work from.

### A form is being flooded

Rate limits are in `src/lib/rateLimit.ts` (inquiry 5/hour, newsletter 1/minute,
investment 10/hour per IP). If they are being evaded:

1. Add a Cloudflare rule for the source — the edge is the right layer.
2. Review what got through: `GET /api/admin/forms?flaggedAsSpam=false`.
3. Setting `AKISMET_API_KEY` adds Akismet on top of the local heuristics.
   Note that it sends submission content to a third party — §11 requires legal
   review first.

### Suspected credential compromise

```sql
-- End every session for one user. They must sign in again; their access token
-- stops working within 15 minutes.
UPDATE refresh_tokens SET revoked_at = NOW()
 WHERE user_id = '<uuid>' AND revoked_at IS NULL;

-- Deactivate the account outright.
UPDATE users SET is_active = FALSE WHERE id = '<uuid>';
```

To end **every** session for everyone, rotate `JWT_SECRET` and restart. That
invalidates all access tokens immediately.

Check the audit log for what the account did:

```sql
SELECT created_at, action, entity_type, entity_id, ip_address
  FROM audit_log WHERE actor_id = '<uuid>' ORDER BY created_at DESC LIMIT 100;
```

The application logs a warning when it detects a replayed refresh token
(`Refresh token reuse detected`) — that line means a token was captured, and is
worth investigating rather than dismissing.

---

## Routine procedures

### Applying migrations

```bash
npm run db:migrate:status    # what is pending
npm run db:migrate           # apply
```

Each migration runs once inside a transaction and is checksummed. Editing a
migration that has already been applied is a hard error — schemas would
otherwise diverge silently between environments. Add a new migration instead.

Migrations run before app servers restart, so **every migration must be
backward-compatible with the code currently running**. Add a nullable column
and backfill later; never rename in place in a single release.

### Verifying the retention purge (NDPA)

The nightly job runs at 02:00 UTC. Confirm it is doing its work:

```sql
-- Should be zero after a successful run.
SELECT count(*) FROM form_submissions
 WHERE retain_until < NOW() AND anonymised_at IS NULL;

-- Page views older than the retention window; also expect zero.
SELECT count(*) FROM page_views WHERE viewed_at < NOW() - INTERVAL '30 days';
```

Run it by hand if needed:

```bash
node -e "require('tsx/cjs');require('./src/lib/queues/processors').processMaintenanceJob({data:{action:'purge-expired-data'}}).then(()=>process.exit(0))"
```

### Handling a data subject request

**Access:** `GET /api/users/[userId]/export` as that user or an admin. Returns
JSON covering the profile, form submissions, page views, sessions and newsletter
record.

**Erasure:** `DELETE /api/users/[userId]`. Deactivates the account, releases the
email address, anonymises every submission from it and removes the newsletter
record. Both actions are written to the audit log.

For someone who never held an account — an enquirer asking for erasure — there
is no user row, so anonymise by address:

```sql
UPDATE form_submissions
   SET name = NULL, email = NULL, phone = NULL, message = NULL,
       ip_address = NULL, user_agent = NULL, metadata = '{}'::jsonb,
       anonymised_at = NOW()
 WHERE lower(email) = lower('<address>') AND anonymised_at IS NULL;

DELETE FROM newsletter_subscribers WHERE lower(email) = lower('<address>');
```

### Approving investor content

Investor figures are withheld from the public API until legal approves them:

```
POST /api/admin/projects/<projectId>/investor-approval
{ "approved": true, "note": "Reviewed by legal, ref LGL-2026-014" }
```

Editing `investorHighlights` afterwards revokes the approval automatically —
re-approval is required after any change. Both actions are audited.

### Rotating the JWT secret

Signs everyone out immediately, so schedule it outside business hours.

```bash
openssl rand -hex 32                    # new value
# update the secret store, then on every app server:
pm2 restart cobuilt-web --update-env
```

### Adding an admin user

```
POST /api/admin/users/<userId>/role     (as an existing admin)
{ "role": "admin" }
```

Create the account first via `POST /api/auth/register` while authenticated as an
admin. An admin cannot remove their own admin role — that would risk leaving the
deployment with no administrator.

---

## Monitoring

Alert on:

| Signal | Threshold | Why |
|---|---|---|
| `/api/health` non-200 | 2 consecutive failures | Site is down |
| `/api/health` `degraded` | 15 minutes | A dependency needs attention |
| API 5xx rate | > 5% over 5 minutes | §13 |
| p95 response time | > 500 ms | §13 |
| `email` queue failed count | > 10 | Enquiries are not reaching anyone |
| PostgreSQL connections | > 80% of `max_connections` | Exhaustion is imminent |
| Disk on the database volume | > 80% | `page_views` grows fastest |

The application logs a `Slow query` warning above 500 ms with the SQL text
(never the parameters, which may hold personal data) — a useful first index for
performance work.

Sentry is wired via `SENTRY_DSN`. It is a third-party processor: §11 requires
legal review before enabling it in production.
