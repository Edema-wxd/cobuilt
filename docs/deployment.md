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

# 3. Bootstrap the first admin. ALLOW_PUBLIC_REGISTRATION opens unauthenticated
#    account creation, so it is enabled for exactly this one call and disabled
#    again immediately.
ALLOW_PUBLIC_REGISTRATION=true npm start &
curl -X POST localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cobuilt.com","password":"<generated>","fullName":"...","role":"admin"}'
kill %1

# 4. Search indexes (only if Meilisearch is configured)
npm run search:reindex

# 5. Processes
pm2 start npm --name cobuilt-web    -- start
pm2 start npm --name cobuilt-worker -- run worker
pm2 save && pm2 startup
```

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

`.github/workflows/deploy.yml` runs on a push to `main`, after CI passes.
Deployments are serialised — two overlapping deploys would leave the app servers
on different builds.

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

§11 requires a 7-day rolling retention.

```bash
# Nightly, retained 7 days
pg_dump --format=custom --compress=9 "$DATABASE_URL" > /backups/cobuilt-$(date +%F).dump
find /backups -name 'cobuilt-*.dump' -mtime +7 -delete
```

Restore into a scratch database and run the application against it at least
quarterly. An untested backup is not a backup.

Redis holds cache and queue state only — losing it costs in-flight jobs and a
cold cache, not data. Object storage needs its own versioning or replication:
tour assets are not in `pg_dump`.

## Health checks

`GET /api/health` returns:

- **200 `healthy`** — everything reachable.
- **200 `degraded`** — PostgreSQL is up; something optional is not. Serve
  traffic; page during business hours.
- **503 `unhealthy`** — PostgreSQL is unreachable. Take the node out of the pool.

Configure the load balancer on the status code, not the body.
