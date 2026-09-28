# Decisions, deviations and open items

Companion to the Phase 1 technical specification (Var-2026-003). It records
where the implementation departs from the spec and why, what the spec left
open, and what still needs a decision from Varyn or CoBuilt.

---

## 1. Corrections to the specification

These are places where the spec as written could not be implemented as-is.

### 1.1 The schema in §2 is not valid PostgreSQL

`CREATE TABLE` in the spec declares `INDEX ...` clauses and inline `ENUM(...)`
types. PostgreSQL supports neither: indexes are separate `CREATE INDEX`
statements, and enums are named types created with `CREATE TYPE`. The intent is
preserved exactly; only the syntax is corrected. See `db/migrations/0001_init.sql`.

### 1.2 Tables referenced but never defined

The spec's code samples read and write four tables that its schema section does
not define. They are added in the migrations:

| Table | Referenced in |
|---|---|
| `newsletter_subscribers` | §8, newsletter subscription |
| `whatsapp_messages` | §9, WhatsApp webhook |
| `audit_log` | §3, `GET /api/admin/audit-log` |
| `refresh_tokens` | §3/§4, implied by "logout invalidates token" |

`projects.investor_highlights_approved` is likewise read by §10's approval gate
but absent from §2's `projects` table; it is added, along with who approved it
and when.

### 1.3 A stateless JWT cannot be invalidated

§3 specifies `POST /api/auth/logout` to "invalidate token", and §4 specifies
stateless JWTs. These cannot both hold: nothing recalls a signed token before it
expires.

Resolution: access tokens stay stateless and short-lived (15 minutes, as
specified). Refresh tokens become opaque random strings, stored hashed in
`refresh_tokens`, single-use and rotated on every refresh. Logout revokes the
refresh token, so the session ends within one access-token lifetime at worst.
Rotation also gives token-theft detection: a token that was exchanged and is
then replayed revokes every session for that user.

A token revoked by *logout* is treated differently from one replayed after
*rotation*. A stale browser tab retrying a logged-out token is ordinary and
must not sign the user out of their other devices; only a replayed, already
exchanged token indicates theft.

### 1.4 `express-rate-limit` does not compose with Next.js API routes

§11 sketches `export default formLimiter(handler)`. `express-rate-limit`
returns Express middleware with a `(req, res, next)` signature; a Next.js route
handler is a plain `(req, res)` function and there is no `next` to call. The
suggested composition silently never runs the handler.

Resolution: `src/lib/rateLimit.ts` implements the same limits directly against
Redis, applied declaratively per route. Counters are shared across the three app
servers of §14. It fails open — Redis being down must not take the public
website offline, and Cloudflare's edge rate limiting (§11) remains in force.

### 1.5 One multi-statement query cannot be parameterised

§11's data-export sample passes three semicolon-separated statements to one
`db.query` call with a bound parameter. node-postgres rejects that: the extended
query protocol permits one statement per call. Each dataset is fetched
separately in `pages/api/users/[userId]/export.ts`.

Other smaller corrections: §11's anonymisation uses `SET name = "Deleted"`,
where double quotes make `Deleted` an identifier rather than a string, so the
statement fails; §9's auto-reply string contains an unescaped apostrophe that
does not parse; §6's search response reports `total: results.length`, which is
the size of the current page rather than the match count, and would break
pagination.

### 1.6 Route naming collision

§3 lists `GET /api/projects/[slug]` and `PUT|DELETE /api/projects/[projectId]`.
Next.js permits only one parameter name per path segment. The segment is
implemented as `[idOrSlug]` and accepts either form.

### 1.7 Supertest cannot drive a Next.js API route

§16's integration example binds Supertest to `@/pages/api`, which is a directory
of handlers, not an HTTP server. The tests use `node-mocks-http` to invoke
handlers directly, which is the standard approach for `pages/api`.

---

## 2. Decisions taken

### 2.1 PostgreSQL is the system of record for the API

§5 has the CMS owning Projects, News, Leadership, Services and FAQs, while §2
defines PostgreSQL tables for the same content and §12's samples query
PostgreSQL directly. Both cannot be authoritative.

Resolution: the CMS is the *authoring* system of record; PostgreSQL holds the
projection that the API serves. CMS publishes arrive by webhook and are upserted
into PostgreSQL, keyed on `(cms_source, cms_id)`. Request handlers never call
the CMS.

This keeps the website up during a CMS outage, keeps `search_vector`, faceting
and the Passport join in one queryable place, and preserves the editor
experience §5 asks for. See [`cms-sync.md`](cms-sync.md).

### 2.2 Tour uploads are presigned, not proxied

§7's sample posts the file body to an API route. A Next.js route has a 4 MB
default body limit and would hold a worker for the duration of a 50 MB upload.
The browser instead requests a presigned URL, PUTs directly to storage, then
registers the tour — which is only accepted once the object is confirmed
present.

### 2.3 Soft deletes for content

§3 notes "soft delete preferred" for projects. Applied to projects and news:
`deleted_at` is set, every public read filters on it, and the row remains for
audit and restore.

### 2.4 Retention deadlines are stored per row

§11 gives different retention windows per form type. Rather than encoding that
policy in the purge job, each submission stores its own `retain_until` at write
time. The policy is then auditable in the data, and changing it later does not
retroactively delete records captured under the old one.

### 2.5 Expired submissions are anonymised, not deleted

Deleting rows would distort the historical enquiry counts the analytics
endpoint reports. Every identifying field is cleared and `anonymised_at` is set.

### 2.6 Search degrades to PostgreSQL

Meilisearch is optional. Without `MEILISEARCH_URL`, or when it is unreachable,
search and autocomplete run on PostgreSQL full-text and the response reports
`"engine": "postgres"` so the fallback is observable rather than silent.

`websearch_to_tsquery` is used rather than `to_tsquery`: it accepts quoted
phrases and `-exclusions` as users expect, and cannot raise a syntax error on
arbitrary input. Autocomplete uses trigram `word_similarity`, because a partial
word is not yet a lexeme and full-text matching returns nothing for it.

### 2.7 Permissions are recomputed, never trusted from the token

The JWT carries permission claims, but the pipeline recomputes them from the
role on every request. A role change then takes effect within one access-token
lifetime instead of persisting until the token expires.

### 2.8 Contact details are masked in admin list views

Full contact details are returned only by the single-submission endpoint, and
reading one is itself written to the audit log.

### 2.9 The projects index reads the API on the client

`/projects` fetches `/api/projects` and `/api/search/facets` from the browser
rather than in `getServerSideProps`. The list needs PostgreSQL, and a checkout
without a database should still render the page and say plainly that the list
could not be loaded — which is the state the mockup designs for. Filters, sort
and page live in the query string, so a filtered view is shareable and the back
button works.

Three fields the mockup shows are not in the list response, so the page
degrades around them rather than inventing them:

| Shown in the mockup | Status | Rendered as |
|---|---|---|
| Project reference code (`CB-2024-014`) | No such field on `projects` | The card's mono slot carries the location instead |
| `passport.progress` — stage and percent | Detail endpoint only | The progress bar renders only if the list response ever carries it |
| Tag filter | `/api/search/facets?type=project` returns no tags | The Tag select appears once facets include them; `?tag=` filtering already works |

Adding a `reference` column and folding passport progress into the list
serializer would close the first two; both are backend changes, not design ones.

### 2.10 The project page renders on the server

`/projects/[slug]` is the exception to §2.9. A project page is the canonical,
shareable URL for a development, so it needs the project's own SEO fields in
the document head, an Open Graph image for link previews, and a real 404 for a
slug that does not exist — none of which a client-side fetch gives. It reads
the repositories directly in `getServerSideProps` rather than calling its own
API over HTTP: one round trip, and the response shape is guaranteed by the same
serializers the API uses. A database failure still renders the page, with the
"couldn't be loaded" state and a 503, rather than a 500.

Three reads the public API does not expose were added to
`src/lib/repositories/projects.ts` for it — `labelsByIds` for service and tag
names, and `galleryForProject` for album images. `serializeProject` returns
`serviceIds`, `tagIds` and `galleryIds` as bare UUIDs, which is all the list
endpoints need; joining four more tables on every list request to serve one
page would be the wrong trade. Expanding them on the detail endpoint too is a
reasonable follow-up if another client needs them.

What the mockup shows and the data does not carry:

| Shown in the mockup | Status | Rendered as |
|---|---|---|
| Project reference code (`CB-2024-014`) | No such column, as in §2.9 | The hero's mono slot carries "Passport™ open" instead |
| Image captions ("Render · north elevation") | `gallery_albums` stores URLs only | Omitted; images carry an indexed alt text |
| Tour file size | **Is** in the API (`fileSizeBytes`) | Shown, against the mockup's flag that it was missing |

Gallery albums attach to a project two ways — `gallery_albums.project_id`, which
a CMS mirror would set, and `projects.gallery_ids`, which is what the admin API
actually writes. `galleryForProject` accepts both, because matching only the
first would have meant every album attached the supported way silently
disappeared.

The mockup's "More in Lagos" row is the index query filtered by this project's
location, so no related-projects field was needed.

3D tours are entered but not yet viewed in-house. Whether a tour can be opened
is decided by its **type**, not by whether a URL happens to be set: the admin
route fills a `threejs_model`'s `tour_url` with the public URL of the .glb
itself, so a URL says nothing about whether there is a page to frame. A
`matterport_embed` or `custom_viewer` with an **https** `tour_url` opens in the
designed viewer chrome; a `threejs_model`, and a `matterport_embed` carrying
only `embed_code`, both show the mockup's fallback panel with copy that says
which of the two it is.

Two things are withheld from the viewer deliberately. `embed_code` is never
injected — it is CMS-authored HTML, and rendering it would be an XSS path. And
the `tour_url` is vetted as https on the server before it reaches the browser,
then framed with `sandbox`: an editor-supplied `javascript:` URL in an iframe
`src` executes in this page's context, which is the same hole withholding
`embed_code` closes.

Passport links are a stopgap. `/projects/[slug]/passport` does not exist yet
(design handover §3.1), so `passportHref()` in `components/site.ts` resolves
every Passport link — the index cards and this page's hero — to the passport
summary band on the project page rather than to a 404. That function is the one
place to change when the Passport page ships.

### 2.11 `DATE` columns are serialized from their calendar parts

`toDateOnly` pushed `DATE` values through `toISOString()`. pg returns a `DATE`
as a Date at *local* midnight, so anywhere west of UTC that reported the
previous day — a Passport opened on 15 January was served as the 14th. The
helper now reads the year, month and day as stored. This was a live API bug,
not only a page bug: the same dates are wrong in `/api/projects/[idOrSlug]` and
in every passport milestone response.

---

## 3. Still open

Carried from §17, with a recommendation where the work surfaced one.

| Item | Status | Notes |
|---|---|---|
| **CMS platform** | Open — Strapi assumed | The sync layer reads both Strapi v4 (`attributes`-nested) and v5 (flat) payloads. Moving to Sanity or Contentful means rewriting `src/lib/cms/` only. |
| **Search engine** | **Recommend Meilisearch**, or neither for now | At Phase 1 corpus size the PostgreSQL fallback is adequate. Adding Meilisearch is a config change; Elasticsearch is not warranted by anything in the requirements. |
| **Email provider** | Open | SendGrid and Mailgun are implemented behind `MAIL_PROVIDER`. **SES is not implemented** — it throws on startup rather than silently dropping mail. Deliverability from Nigerian infrastructure should decide this. |
| **Chat platform** | Open | The webhook stores events generically and commits the schema to neither vendor. |
| **Payment processor** | Deferred to Phase 2 | No transactional code exists; §10 forbids it in Phase 1. |
| **3D tour format** | All three supported | `threejs_model`, `matterport_embed` and `custom_viewer` are handled; a database constraint enforces that each carries the payload its type needs. |

### Needs a decision from CoBuilt

1. **Who approves investor content?** The gate is built and audited, but the
   approving role is currently `admin`. If legal sign-off should sit with a
   distinct role, say so and it becomes one.
2. **Data residency for third parties.** Postgres, Redis and object storage are
   Nigeria-hosted per §11, but SendGrid, Akismet, Sentry and any chat vendor
   process personal data abroad. §11 requires legal review before that happens;
   the code works with all of them disabled.
3. **Newsletter double opt-in** is implemented (NDPA consent). If marketing
   wants single opt-in, that is a policy decision, not a technical one.

### Deferred to Phase 2

Investor portal accounts and transactions, push notifications for milestones,
automated case-study PDFs, multi-language content, and construction webcam
streaming. The `investors` table exists so the portal does not need a migration
against live data.
