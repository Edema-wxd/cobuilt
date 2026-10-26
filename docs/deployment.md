# Deployment guide

Target infrastructure per §14: a Nigerian Tier III data centre for data
residency (§11), with Cloudflare in front for CDN and DDoS protection.

## Topology

```
                    Cloudflare (CDN, WAF, DDoS, edge rate limiting)
                                    │
                              Nginx / HAProxy
                              ┌─────┴─────┐
                        app-1 │           │ app-2        app-3
                     (Next.js)│           │(Next.js)   (worker)
                              └─────┬─────┘               │
                    ┌───────────────┼───────────────┬─────┘
              PostgreSQL 16      Redis          Meilisearch      Object storage
             (primary+replica)  (sentinel)      (optional)      (S3-compatible)
```

`app-1` and `app-2` serve HTTP. `app-3` runs `npm run worker` only — email
delivery, search indexing and the nightly maintenance job. Running the worker on
a web node is possible but couples job load to request latency.

## Prerequisites

| Component | Version | Notes |
|---|---|---|
| Node.js | 22 LTS | 20 is the floor (`engines` in package.json) |
| PostgreSQL | 14+ (16 recommended) | Needs `pg_trgm` and `pgcrypto` |
| Redis | 7 | Cache, rate limiting, job queues |
| Meilisearch | 1.x | Optional — see [decisions](decisions.md#26-search-degrades-to-postgresql) |
| Object storage | S3-compatible | AWS S3, DigitalOcean Spaces, or a local equivalent |
| pm2 | latest | Process supervision |
| PostgreSQL client tools | Same major version as the server, or newer | `pg_dump`, `pg_restore` on the worker host, for backups (`apt install postgresql-client-16`) |

## First deployment

```bash
# 1. Database
createdb cobuilt
psql cobuilt -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pgcrypto;'

# 2. Application
git clone <repo> /srv/cobuilt && cd /srv/cobuilt
npm ci
cp .env.example .env.production      # fill in — see below
npm run db:migrate
npm run build

# 3. Create the first admin directly in the database. With ADMIN_PASSWORD
#    unset, a random password is generated and printed once. Further accounts
#    are created by an admin through POST /api/auth/register.
npm run user:create-admin -- --email admin@cobuilt.com --name "Full Name"

# 4. Search indexes (only if Meilisearch is configured)
npm run search:reindex

# 5. Processes
pm2 start npm --name cobuilt-web    -- start
pm2 start npm --name cobuilt-worker -- run worker
pm2 save && pm2 startup

# 6. Backups and alerts, on the worker host (app-3). See "Backups" and
#    "Monitoring and alerts" below for the settings these need.
createdb cobuilt_restore_check          # scratch database for the weekly restore check
sudo install -m 644 ops/cron/cobuilt /etc/cron.d/cobuilt   # edit the user column first
npm run db:backup                       # first backup now, rather than tonight
npm run ops:check -- --test-alert       # every check OK, and the test alert arrives
```

Every script (`npm run worker`, `db:migrate`, `db:backup` and the rest) loads
`.env.production` from the repository directory the same way `next start`
does, so pm2 and cron need no environment of their own. Variables already set
in the environment take precedence.

## Required configuration

The app refuses to boot in production without `DATABASE_URL`, `REDIS_URL`,
`JWT_SECRET` and `ALLOWED_ORIGINS`. Every variable is declared in
`src/lib/env.ts`; `.env.example` is the annotated template.

Generate the JWT secret with `openssl rand -hex 32` — a 32-byte random value,
never a passphrase. It must be identical across app servers, or a token issued
by one will be rejected by the other.

`ALLOWED_ORIGINS` is an exact-match list. The CORS layer echoes the request
origin only when it appears there; the wildcard is never used, because
credentialed requests require an exact echo.

Secrets belong in the deployment secret store, not in the repository. §11
suggests HashiCorp Vault for production.

## Ongoing deployments

`.github/workflows/deploy.yml` runs on a push to `main`. Its first job is the
full CI workflow (typecheck, lint, migrations against an empty database, tests,
build); the deploy job runs only if that passes, and the servers check out that
exact commit rather than the current tip of `main`. Deployments are serialised:
two overlapping deploys would leave the app servers on different builds.

Order matters: migrations run **once, before** any app server restarts, so the
two web nodes never serve traffic against different schema versions. Because of
that, migrations must be backward-compatible with the running code — add a
nullable column and backfill in a later release rather than renaming in place.

Manual equivalent:

```bash
cd /srv/cobuilt
git fetch --all && git reset --hard origin/main
npm ci
npm run db:migrate
npm run build
pm2 reload cobuilt-web --update-env
pm2 reload cobuilt-worker --update-env
curl -fsS https://cobuilt.com/api/health
```

`pm2 reload` restarts workers one at a time, so the deployment does not drop
connections.

## Nginx

```nginx
upstream cobuilt {
    server 10.0.0.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.0.12:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name cobuilt.com www.cobuilt.com;

    ssl_protocols TLSv1.3 TLSv1.2;               # §11: TLS 1.3
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Tour models are up to 50 MB, but they are uploaded directly to object
    # storage with a presigned URL. Nothing that transits Nginx is large.
    client_max_body_size 2m;

    location / {
        proxy_pass http://cobuilt;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        # The rate limiter and audit log read these; see lib/http/request.ts.
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    location /api/health {
        proxy_pass http://cobuilt;
        access_log off;
    }
}
```

## Cloudflare

- **SSL/TLS:** Full (strict).
- **Caching:** the API sets its own `Cache-Control`; respect origin headers
  rather than overriding them.
- **Never cache:** `/api/auth/*`, `/api/admin/*`, `/api/forms/*`,
  `/api/integrations/*`. These already send `no-store`, but a cache rule is
  cheap insurance.
- **Rate limiting:** per §11, auto-block at 25,000 requests / 10 s. The
  application limiter is the finer-grained layer and fails open, so the edge
  rule is the backstop.
- **`CF-Connecting-IP`** must reach the origin: it is the trusted client IP.

## Backups

§11 requires a 7-day rolling retention. Backups run on the worker host, which
keeps them off the database server.

| Setting | Default | Purpose |
|---|---|---|
| `BACKUP_DIR` | unset (backups off) | Where archives are written, e.g. `/var/backups/cobuilt` |
| `BACKUP_RETENTION_DAYS` | `7` | Archives older than this are deleted after each successful backup |
| `BACKUP_MAX_AGE_HOURS` | `26` | The monitor alerts when the newest archive is older than this |
| `RESTORE_CHECK_DATABASE_URL` | unset | Scratch database for the weekly restore check |

`ops/cron/cobuilt` schedules two jobs:

- **Nightly, 01:30** `npm run db:backup`: `pg_dump` to a temporary file, check
  that `pg_restore` can read the whole archive, then move it into place and
  prune old ones. The newest archive is never pruned. Archives are mode `0600`
  in a `0700` directory, because they hold personal data. The database password
  is passed through the environment, never on the command line.
- **Sundays, 04:00** `npm run db:restore-check`: restore the newest archive
  into `RESTORE_CHECK_DATABASE_URL`, check that it has its migrations and core
  tables, then empty that database again so no second copy of the personal
  data stays there.

Either one failing sends a critical alert. Output goes to `logs/backup.log`.

The scratch database is wiped on every run, so it must never be the live one:
the check refuses a URL with the same database name as `DATABASE_URL`. Its
user needs to own the database (to create `pg_trgm` and `pgcrypto`) and
nothing else.

Restoring for real is in the runbook under "Restoring from a backup".

Redis holds cache and queue state only; losing it costs in-flight jobs and a
cold cache, not data. Object storage needs its own versioning or replication:
tour assets are not in `pg_dump`.

## Health checks

`GET /api/health` returns:

- **200 `healthy`** — everything reachable.
- **200 `degraded`** — PostgreSQL is up; something optional is not. Serve
  traffic; page during business hours.
- **503 `unhealthy`** — PostgreSQL is unreachable. Take the node out of the pool.

Configure the load balancer on the status code, not the body.

## Monitoring and alerts

The worker watches the site and sends alerts itself, on a timer that keeps
running when Redis is down:

| Check | Alerts when | Severity |
|---|---|---|
| Each URL in `HEALTHCHECK_URLS` | Unreachable, or `unhealthy`, on 2 checks in a row | Critical |
| | `degraded` for 15 minutes | Warning |
| Backup freshness (when `BACKUP_DIR` is set) | Newest archive older than `BACKUP_MAX_AGE_HOURS` | Critical |
| Email queue | More than 10 emails failed permanently in the last hour | Warning |

An alert repeats every `ALERT_REPEAT_HOURS` (default 4) while the problem
lasts, and a single "recovered" message follows when it clears.

```bash
HEALTHCHECK_URLS=http://10.0.0.11:3000/api/health,http://10.0.0.12:3000/api/health,https://cobuilt.com/api/health
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...   # receives {"text": "..."}
ALERT_EMAIL=ops@cobuilt.com                               # needs a real MAIL_PROVIDER
```

List each app server as well as the public URL, so one failing node is caught
behind a healthy load balancer. Configure at least one channel and confirm it
with `npm run ops:check -- --test-alert`: with neither set, alerts only reach
the log.

The monitor cannot report that the worker host itself is down. Point an
external uptime service at `https://cobuilt.com/api/health` with a keyword
check for `"healthy"`, so someone hears about it.
