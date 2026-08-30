# CoBuilt Investment Partners — Backend

Backend for the CoBuilt corporate website. Phase 1 covers the public website
API, Project Passport™ milestones, 3D virtual tours and the informational
investor page.

**Reference:** Var-2026-003 · **Phase:** 1 · **Stack:** Next.js API routes,
PostgreSQL 14+, Redis, Meilisearch (optional), S3-compatible object storage.

---

## Quick start

```bash
npm install
cp .env.example .env.local          # then set DATABASE_URL and JWT_SECRET
npm run db:migrate                  # apply schema migrations
npm run db:seed                     # development data (refuses to run in production)
npm run dev                         # http://localhost:3000
npm run worker                      # background jobs, in a second terminal
```

Only PostgreSQL is required to run. Redis, Meilisearch, the CMS and object
storage are each optional in development: the app degrades rather than failing
(see [Degradation](#degradation)).

Verify the install: `curl localhost:3000/api/health`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run worker` | Background job worker (email, indexing, nightly maintenance) |
| `npm run typecheck` | TypeScript, strict mode |
| `npm run lint` | ESLint with type-aware rules |
| `npm test` | Jest — integration suites skip without `TEST_DATABASE_URL` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:migrate:status` | Show applied and pending migrations |
| `npm run db:seed` | Seed development data |
| `npm run search:reindex` | Rebuild every Meilisearch index from PostgreSQL |

## Layout

```
db/migrations/       Numbered SQL migrations, applied once and checksummed
pages/index.tsx      Public landing page — static, renders without a database
pages/api/           Route handlers — thin; policy and I/O live in src/lib
styles/              Global tokens and the landing page's CSS module
src/lib/
  http/route.ts      The request pipeline every endpoint runs through
  auth/              JWT, refresh-token rotation, RBAC, password hashing
  repositories/      All SQL. Nothing else in the codebase writes queries
  schemas/           Zod request schemas
  search/            Meilisearch with a PostgreSQL full-text fallback
  queues/            BullMQ producers and job processors
  cms/               Strapi client and webhook sync
  serializers.ts     Row → DTO mapping, and the investor-content gate
scripts/             Migration runner, worker, seed, reindex
docs/                OpenAPI spec, deployment guide, runbook, decisions
__tests__/           Unit, request-pipeline and database integration tests
```

Routes declare their policy rather than composing middleware by hand:

```ts
export default createRoute({
  GET: {
    query: listProjectsQuery,          // Zod — a failure is a 422 naming the field
    auth: 'optional',                  // ctx.auth is populated when a token is valid
    rateLimit: RATE_LIMITS.api,        // Redis-backed, shared across app servers
    cache: { sMaxAge: 3600 },          // CDN cache policy
    handler: async ({ query, auth }) => { /* ... */ },
  },
  POST: {
    body: createProjectBody,
    roles: ['admin', 'editor'],
    permission: 'projects:write',
    handler: async ({ body, auth }) => created(/* ... */),
  },
});
```

An endpoint therefore cannot ship without validation or an access decision, and
its whole policy is readable in one place.

## Authentication

Access tokens are stateless JWTs valid for 15 minutes. Refresh tokens are
opaque, single-use, stored hashed in PostgreSQL and rotated on every use; a
token that was exchanged and is then replayed revokes every session for that
user. Logout revokes one session only.

```
POST /api/auth/login      → { accessToken, csrfToken }  + HTTP-only refresh cookie
POST /api/auth/refresh    → new access token, rotates the refresh cookie
POST /api/auth/logout     → revokes that refresh token
```

Send `Authorization: Bearer <accessToken>` on API calls. Cookie-authenticated
writes additionally need `X-CSRF-Token` matching the readable CSRF cookie
(double-submit).

Roles are `admin`, `editor`, `viewer` and `investor` (Phase 2, no Phase 1
permissions). Per-user grants and revocations live in `users.permissions`;
revocation always wins. Permissions are recomputed from the role on every
request rather than trusted from the token, so a role change takes effect
within one access-token lifetime.

## Degradation

Only PostgreSQL is a hard dependency. Everything else fails soft, and
`/api/health` reports `degraded` rather than `unhealthy`:

| Dependency | When it is down |
|---|---|
| Redis | Cache misses fall through to PostgreSQL; rate limiting is bypassed (Cloudflare's edge limits still apply) |
| Meilisearch | Search and autocomplete fall back to PostgreSQL full-text; responses report `"engine": "postgres"` |
| CMS | No effect on reads — request handlers read PostgreSQL, never the CMS |
| Object storage | Tour uploads fail; existing tours keep serving from the CDN |
| Mail / queues | The submission is already committed; the notification is retried by the queue |

## Data protection (NDPA)

- Visitor IPs are truncated (`/24`, or `/48` for IPv6) before a page view is stored.
- Form submissions carry a `retain_until` deadline — 90 days, or two years for
  investor enquiries — and the nightly job anonymises rows past it.
- `GET /api/users/[userId]/export` is a subject access request; `DELETE
  /api/users/[userId]` is erasure. Both are self-service or admin-performed,
  and both are audited.
- Investor figures on a project are withheld from the public API until legal
  approves them, and editing that content revokes the approval automatically.

## Documentation

- [`docs/openapi.yaml`](docs/openapi.yaml) — the API contract
- [`docs/cms-sync.md`](docs/cms-sync.md) — how CMS content reaches PostgreSQL
- [`docs/deployment.md`](docs/deployment.md) — infrastructure and deploy process
- [`docs/runbook.md`](docs/runbook.md) — operational procedures and incident response
- [`docs/decisions.md`](docs/decisions.md) — decisions taken, deviations from the
  spec, and what is still open
