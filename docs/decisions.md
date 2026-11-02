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

`projects.investor_highlights_approved` is likewise read by §10's approval gate
but absent from §2's `projects` table; it is added, along with who approved it
and when.

### 1.3 Identity is Neon Auth (supersedes the original JWT design)

§3 and §4 specified self-issued stateless JWTs plus refresh tokens in
`refresh_tokens`. Identity now belongs to Neon Auth (Managed Better Auth):
credentials, email verification, password reset and sessions live in the
`neon_auth` schema, and its 15-minute EdDSA access tokens are verified here
against the branch JWKS. `refresh_tokens` and the password columns' use were
removed (migration 0014).

Authorisation stays in this application. A Neon Auth user is joined to a row in
`users` — which holds role, per-user permissions and `is_active` — on first
sign-in, and only when Neon Auth reports the address as verified: linking on an
unverified address would let anyone who signs up with an administrator's email
take the account over. A signed-in Neon Auth user with no `users` row is refused.
Because role and `is_active` are read from `users` on every request, a role
change or deactivation takes effect at once instead of when a token expires.
Neon Auth's "Require email verification" is switched on for the same reason.

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

### 2.2 Tour uploads go direct to storage, not through the API

§7's sample posts the file body to an API route. A Next.js route has a 4 MB
default body limit and would hold a worker for the duration of a 50 MB upload.
The browser instead uploads directly to UploadThing, the sole object store,
through its file router (`pages/api/uploadthing.ts`), whose middleware checks
the console's bearer token and the `tours:write` permission. It then registers
the tour — which is only accepted once the file is confirmed present.

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
rather than on the server. The list needs PostgreSQL, and a checkout
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
the repositories directly in `app/projects/[slug]/load-project.ts` rather than
calling its own API over HTTP: one round trip, and the response shape is
guaranteed by the same serializers the API uses. A database failure still
renders the page with the "couldn't be loaded" state rather than a 500 — see
§2.12 for the status code that changed with the router migration.

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

Passport links are no longer a stopgap: `passportHref()` resolves to the record
itself, which is built — see §2.14. The project page keeps its summary band,
and the band's trailing link now opens the full record rather than the
Passport explainer.

### 2.11 `DATE` columns are serialized from their calendar parts

`toDateOnly` pushed `DATE` values through `toISOString()`. pg returns a `DATE`
as a Date at *local* midnight, so anywhere west of UTC that reported the
previous day — a Passport opened on 15 January was served as the 14th. The
helper now reads the year, month and day as stored. This was a live API bug,
not only a page bug: the same dates are wrong in `/api/projects/[idOrSlug]` and
in every passport milestone response.

### 2.12 The pages are App Router; the API stays on the pages router

The handover specified the pages router (design handover §preamble). The pages
now live in `app/`; the API routes stay in `pages/api`, with one exception noted
below. The two coexist in one Next application, which is what made the split
worth taking: every reason to be on the App Router — Server Components, nested
layouts, the metadata API — is on the page side, while the API's value is in one
request pipeline (`src/lib/http/route.ts`) that already works and is exercised by
the test suite. Moving it would mean rewriting that pipeline and six library
modules around Web `Request`/`Response` for no behavioural gain.

**The exception is the CMS webhook.** `revalidatePath` is the only way to
revalidate an App Router page, and calling it from a pages API route throws
`Invariant: static generation store missing` — every time, silently, because the
call is wrapped in a best-effort try/catch. So
`app/api/integrations/cms-webhooks/route.ts` is an App Router route handler: a
route whose job is to revalidate pages has to live where the page cache does. It
never used the shared pipeline anyway, because an HMAC signature has to be
checked against the raw bytes before anything parses them; `readRawRequestBody`
in `src/lib/http/rawBody.ts` is the Web `Request` equivalent of `readRawBody`.
`__tests__/unit/openapi.test.ts` scans `app/api` as well as `pages/api` so the
spec-drift check still covers it.

What this changed on the page side:

| Was | Now |
|---|---|
| `pages/_app.tsx` + `pages/_document.tsx` | `app/layout.tsx`, with `viewport` and an icon in `metadata` |
| `next/head` per page, via `SiteLayout`'s `title`/`description` props | A `metadata` export per page; the root layout holds the `%s — CoBuilt Investment Partners` title template |
| `getServerSideProps` in `pages/projects/[slug].tsx` | `app/projects/[slug]/load-project.ts`, wrapped in `cache` so the page and `generateMetadata` share one set of queries |
| `useRouter().query` on the index | `useSearchParams()`, with `router.push` from `next/navigation` |
| `res.revalidate(path)` in the CMS webhook | `revalidatePath(path)`, from an App Router route handler — see above |

Two consequences worth knowing:

- **`/projects` is rendered per request** (`dynamic = 'force-dynamic'`). Its body
  reads the query string through `useSearchParams`, which a static prerender
  cannot resolve; Next would otherwise require a Suspense boundary and the
  prerendered HTML would be the fallback rather than the page. Rendering
  dynamically means the server sends the full page, chrome and loading state
  included, already reflecting the filters in the URL.
- **A project page no longer returns 503 when the database is down.** An App
  Router page cannot set its own status code. The visible behaviour is
  unchanged — the "couldn't be loaded" state still renders — but the status is
  now 200. If the status matters to monitoring, it needs a route handler or
  middleware.

Components that hold state or handlers — `SiteHeader`, `SiteFooter`,
`CookieBanner`, the two project pages and the landing page — carry
`'use client'`. The prose pages are server components; the one button on the
cookie policy page is split into `components/CookiePreferencesButton.tsx` so the
page itself did not have to become a client component.

---

### 2.14 The Project Passport™ record is server-rendered, and everything on it is dated

`/projects/[slug]/passport` is the page the brief rests on (design handover
§3.1): a permanent, public record of one development, milestone by milestone.
It is built in `app/projects/[slug]/passport/`, and it is a **server component**
with no client JavaScript at all. The project page next door is a client
component because it drives a gallery and a tour viewer; a record has nothing
to drive, and three things follow from rendering it on the server:

- every entry is in the HTML as served, so no filter or disclosure hides part of
  the record from a reader, a crawler or a printer;
- the page is readable with JavaScript off, which for a document whose whole
  claim is permanence is the right default;
- the timestamps are formatted once, on the server, rather than differing
  between the server render and the browser's zone.

**A slipped date is reported, never revised.** Every entry shows the date the
milestone was scheduled for beside the date it was met, and states the variance
in words — "10 days ahead of schedule", "5 days later than scheduled". A
milestone whose status is `delayed` with no actual date yet says so explicitly
and does not invent a revised date. The count of delayed milestones is
disclosed in the progress band *above* the record, so a reader does not have to
find it. `delayed` stays an outlined chip rather than a red one: it is a fact
about a programme, not a failure state.

**Provenance is on the page**, because credibility is the product here. The
project ID, the number of entries, the time each entry was written into the
record, and whether an entry was later revised. Times are reported in **West
Africa Time**, converted by hand as a fixed UTC+1 rather than through `Intl`:
WAT has no daylight saving, and a fixed offset renders the same string on every
server and in every runtime, which is what makes two readers of an archive
agree about it. `formatRecordedAt` and the date helpers are covered by
`__tests__/unit/passport.test.ts`, including the §2.11 west-of-UTC case.

Four states, all designed: the record; a Passport that is open with nothing
recorded yet; a project whose Passport is not open at all, which answers rather
than 404s because the URL is a real one for a real development, and which
`generateMetadata` marks `noindex` so it cannot win a search result that would
disappoint; and a database that could not be reached.

Editor-supplied URLs are vetted on the server, in the loader, before they reach
the browser — the same posture as the tour viewer. A document or video URL that
is not `https` is dropped rather than rendered, so a `javascript:` URL in
`document_urls` never becomes an `href`. Document names are read from the last
segment of the URL, because `document_urls` is a bare text array with no title
column and the alternative is a link that reads as a CDN path.

No investment call to action, per the brief's §1 — and this page publishes no
figures, so unlike the project page it carries no investor band and the
licensing notice has nothing to attach to. Its closing band states the terms
the record is kept under and points at the development and the portfolio.

Two things were factored out rather than copied. `app/projects/[slug]/project-shared.tsx`
now holds the primitives both pages use — the date formatters, the milestone
labels, the status chips, the URL vetting — so the formatters that §2.11 records
getting wrong exist once. And a project change in the CMS webhook now
revalidates `/projects/[slug]/passport` alongside the index and the detail page,
since the record is a page of its own.

What the data does not carry, and which therefore degrades rather than appears:

| Wanted | Status | Rendered as |
|---|---|---|
| A citable reference per entry | `passport_milestones` has a UUID, which is not a human reference | The entry's position in the published sequence (`Entry 03`), with the recorded-at timestamp beside it |
| Photo captions | `photo_urls` is a bare text array | Tiles carry an indexed alt text naming the milestone |
| An embedded site video | `video_url` is unvetted CMS input, as `embed_code` is (§2.10) | A link that opens in a new tab, https only — never an iframe |

### 2.15 The six anchor nav items are pages, not anchors

Six of the nine mandated nav items — About, Leadership, Services, Passport™,
Media and Contact — pointed at a band on the landing page, and Contact pointed
at the newsletter form, which is a different thing from an enquiry. Fifteen
links on the landing page resolved to an anchor instead of a destination. All
of them now reach a page:

| Nav item | Page | Content source |
|---|---|---|
| About | `/about` | Static |
| Leadership | `/leadership` | Static at launch; `leadership` table since §2.20 |
| Services | `/services`, `/services/[slug]` | PostgreSQL, managed in the console (§2.21); `app/services/services.ts` as fallback |
| Passport™ | `/passport` | Static |
| Media | `/news`, `/news/[slug]`; `/media` since §2.22 | `/api/news`; `/media` reads the repository |
| Contact | `/contact` | Posts to `/api/forms/inquiry` |

**Contact and newsletter are separate, and separately consented.** `/contact`
posts to `/api/forms/inquiry` — it reaches a person, and the NDPA consent is
for replying to the enquiry. The landing page's band keeps the newsletter
(`/api/forms/newsletter`, double opt-in), and its third hero action is now
labelled "Register your interest" rather than "Contact us", because that is
what it does.

**The landing page's own service cards and the service pages read one module.**
`app/services/services.ts` holds the six disciplines; the landing grid imports
it rather than keeping its own copy, so the card line and the page cannot drift.
Property Investment stays informational there and on its page: no call to
action, and the licensing notice above the fold rather than only at the foot.

**Services, About, Leadership and Passport™ are static.** (Services and Leadership no longer are: see §2.20 and §2.21.) There is a `services`
table, but it is filter taxonomy — a name, a slug, a one-line description — and
no endpoint publishes page copy. Rather than invent CMS content types, these
pages hold their copy in the repo and render without PostgreSQL, like the
landing page. The media centre is the opposite case: `/api/news` exists, so
`/news` reads it on the client (§2.9) and `/news/[slug]` on the server (§2.10).

**`/news/category/[category]` is not a route.** The category is a filter on the
media centre (`/news?category=update`), which keeps one list, one empty state
and one pagination implementation. The API route of that name is untouched.

**Article bodies are rendered without `dangerouslySetInnerHTML`.**
`news_articles.content` is free text with no declared format and the CMS is not
settled (design handover §5.1), so `components/ArticleBody.tsx` strips HTML
tags to their text and honours a Markdown subset — headings, lists, quotes.
Inline emphasis is deliberately not parsed: losing `**bold**` mid-sentence is
cosmetic, where a half-built inline parser on editor input is a real risk. One
file to replace when the CMS is confirmed.

**Three patterns were extracted rather than copied.** `components/sections.ts`
holds the section bands, titles and card classes the landing page established;
`components/PageHero.tsx` is the charcoal page header, and it carries the
breadcrumb trail the handover's §4 asked for; `components/CtaBand.tsx` is the
closing band, which is the only place a new page can offer an action — and it
offers an enquiry or a registration, never an investment. New contrast pairings
are in `__tests__/unit/contrast.test.ts` as usual.

**Links with nothing honest behind them were pointed at the nearest true
thing, not invented.** The landing page's three illustrative project cards go
to `/projects` rather than to slugs no CMS row has; LinkedIn and YouTube in the
utility strip go to the contact page and the video library, because the
company's accounts are unconfirmed and a guessed URL is worse than a local one;
WhatsApp Business goes to `wa.me` on the office number. Governance, Downloads
and FAQs stay unlinked in the footer, as they were.

### 2.16 The Three.js tour viewer asks before it downloads, and says why it failed

`threejs_model` tours open in the page (`app/projects/[slug]/model-viewer.tsx`)
in the same viewer chrome the Matterport and custom embeds already used:
"Enter the tour", Fullscreen, Exit tour, Escape, and the tour list beside it
for switching. What a model adds is weight, so the design is about what
happens before and around the download.

**Three.js is not in the page bundle.** It and its loaders are imported inside
the viewer's effect, fetched only when someone enters a model tour and in
parallel with the model. A chunk that fails to load is reported as a failed
download, not thrown at the page's error boundary.

**The device is assessed first** (`tour-model.ts`, `assessDevice`). No WebGL
means no download at all and an explanation. A model over 25 MB, or of unknown
size, on a device reporting 2 GB of memory or less, or with the browser's data
saver on, gets a "This is a large model" prompt naming the size, with "Load
anyway" beside the gallery. Everything else just loads. `deviceMemory` exists
only in Chromium; its absence is not taken as evidence of a weak device.

**The model is downloaded with `fetch`, not the loader's own request**, so
progress is real (a percentage of Content-Length, or of the size the admin
recorded) and Cancel, Exit and switching tours actually stop the transfer.

**The file is identified by its bytes.** Storage URLs carry no extension, and
the admin console accepts .glb, .gltf and .zip. A zip is unpacked in the
browser (fflate) and its scene's buffers and textures are handed to the loader
as blob URLs. Draco and Meshopt compression are both supported: the Meshopt
decoder is bundled, and the Draco decoder is served from
`public/vendor/draco/`, copied from `three/examples/jsm/libs/draco/gltf`. Recopy
it when upgrading three.

**Failures are told apart, because the way out differs:**

| Failure | Cause | Offered |
|---|---|---|
| No WebGL | Browser or device can't do 3D | Gallery, Back |
| Network | Download failed or the file is unreachable | **Try again**, Gallery, Back |
| Format | Not a model, an empty one, or an extension the loader rejects | Gallery, Back |
| Render | WebGL wouldn't start, or the GPU dropped the context mid-tour | Gallery, Back |

The model URL passes the same https check as embed URLs before it reaches the
browser (`load-project.ts`). The bucket must send CORS headers allowing the
site's origin, because the download is a cross-origin `fetch`. UploadThing's
file URLs are expected to do so, but this has not been tested against a live
file.

Fullscreen is offered only where `document.fullscreenEnabled` says it works,
which excludes iPhone Safari. The viewer itself is keyboard-operable: focus it
and the arrow keys pan, and "Reset view" restores the opening angle.

### 2.17 The contact map loads on request, and waits for a confirmed location

The handover left the map undecided (§3.6). It is built
(`app/contact/office-map.tsx`) on two conditions.

**It is click-to-load.** An embedded map is a request to a third party as soon
as it renders, which hands over the visitor's IP address before they have
chosen anything. The page shows a still panel with "Show the map", and the
frame exists only after that click. OpenStreetMap rather than Google Maps,
because the OSM embed sets no cookies and so needs no cookie category. "Get
directions" opens the visitor's own maps app and needs no embed at all.

**It is hidden until `OFFICE_LOCATION` in `components/site.ts` is set.** The
published address, 27 Apex Drive, TechZone District, Victoria Heights, does
not geocode, and a pin in the wrong place sends people to the wrong building.
CoBuilt needs to supply the office's coordinates. Setting them is the whole
change.

### 2.18 Every page has a social preview image

`components/og.tsx` draws a branded 1200×630 card with Next.js's `ImageResponse`.
`app/opengraph-image.tsx` is the site default. Project, Passport™, article and
service pages have their own beside them, carrying the item's title and one
line of fact: status, milestone progress or publication date.

**An item's own photography wins.** Where a project or article has an Open
Graph or featured image, its `generateMetadata` names that, and Next.js drops
the generated card, because `openGraph.images` set at the same level beats the
file. Twitter cards are now always `summary_large_image`, since there is always
an image.

The root layout sets `metadataBase` from `NEXT_PUBLIC_WEBSITE_URL`. Without it,
relative image URLs (`/images/…`) were emitted as relative `og:image` values,
which link previews ignore. The cards use the renderer's built-in sans rather
than Geist, because fetching a font at build time would break the offline
build.

### 2.19 The homepage is managed in the console, and computes its own figures

The client's spec lists sections the 30 Oct streamline had cut — latest news,
a leadership spotlight, an embedded YouTube video, a "Contact us" action — and
the stat band was four hardcoded numbers. All are back, compact and late on the
page (design handover, "The landing page"), and each band is left out when it
has nothing to show.

**Settings are one JSONB document** under `site_settings.key = 'homepage'`
(migration 0016), with its shape owned by `src/lib/schemas/settings.ts` rather
than by columns. A later field needs no migration, a stored field that no
longer validates falls back on its own, and a key never saved means "as built".
Writes go through `PUT /api/admin/settings/homepage`, behind a new
`settings:write` permission that only `admin` holds, and are audited with the
fields that changed.

**The figures are counted, not claimed.** Delivered, under development and
locations are counted from live projects; there is no units column, so units
show only when an administrator sets them. An override replaces any figure, and
0 hides one. The old figures are kept only as the no-database fallback, so the
build and an outage never show a band of zeros. On a site about documented
delivery, a figure the record can back is the stronger claim — but it means the
band will read lower than the old copy until every delivered project is
entered, or until the figures are overridden.

**A save regenerates the page at once.** §2.12 found `revalidatePath` throws
from a pages API route. `res.revalidate('/')` does not: it asks the running
server to regenerate the path over HTTP, and that works for an App Router page
too (checked against `next start`). It is still best-effort; the page's
one-minute `revalidate` is the guarantee.

**The video is click-to-load**, for the reason in §2.17: the poster is a house
still, not YouTube's thumbnail, so nothing reaches YouTube before the visitor
presses play, and the player is `youtube-nocookie.com`. Only the video ID is
kept from what an editor pastes; the embed URL is built from it. The report-only
CSP already allows both (`frame-src https:`, `img-src https:`), so
`next.config.mjs` is unchanged.

**The leadership spotlight reads the leadership repository** (§2.20): the
profiles switched to "Homepage spotlight" in `/admin/leadership`, or the first three
published ones until anyone is marked.

### 2.20 Leadership profiles come from the database, managed in the console

`/leadership` was static (§2.15). It now reads the published rows of
`leadership` on the server (`export const revalidate = 60`), and each leader has
a profile page at `/leadership/[slug]`. Editors and admins manage them at
`/admin/leadership` under a new `leadership:write` permission; only an admin
deletes. Migration 0017 adds the spec's per-leader fields — `summary`,
`qualifications` and `expertise` (text arrays), `quote`, `photo_alt` — plus
`tier` (`board`, `executive`, `management`), which is what the page's
organisational structure is drawn from, and `featured` for the homepage
spotlight. No existing column was renamed; the Strapi sync writes the new
fields when its model carries them and otherwise leaves the console's values
alone.

**No profile is invented.** With nothing published, or no database (as at
build time), the page keeps the launch state: one approved remit and the
roles whose profiles are awaiting approval. A published leader without a
photograph keeps the "approved portrait" slot rather than a stock face.

**Portraits are an https URL, not an upload.** The only UploadThing route
accepts 3D model files for tours; projects and news take image URLs too.
http is refused because a portrait is shown inline on an https page.

**Running order is saved whole.** The console's arrows send every leader's id
in the new order, and a list that no longer matches the table is a 409. Two
editors reordering at once cannot interleave into an order neither chose.

### 2.21 Services are managed in the console

The client's spec lists a different set of services from the six the site
launched with, and asks for process, benefits, case studies and related
projects on each page. So services became content: `/admin/services` adds,
renames, reorders, publishes and unpublishes them, behind a new
`services:write` permission (admin and editor; deleting is admin-only, like
tours). Public reads are `/api/services` and `/api/services/[slug]`.

**The existing `services` table was extended, not replaced.** It was already
the taxonomy projects are tagged with (`projects.service_ids`), and a second
table of "service pages" would let the two lists drift. Migration 0015 adds the
page columns; `name` stays the title and `description` the card summary. Rows
that predate it arrive unpublished, because they had no page copy. The
migration seeds the six launch services verbatim, so a fresh database renders
the same pages.

**The projects on a page are curated, not derived.** `service_projects` holds
the editor's choice, order and case-study flag. A project's own `service_ids`
says which disciplines it involved, which is usually more than a page should
show. Only published projects appear; drafts can be lined up in advance.

**The pages never depend on the database being up.** `app/services/load-services.ts`
reads the repository, and falls back to `app/services/services.ts` when the
query fails — including in a build with no database. The pages regenerate at
most once a minute, like the landing page, and the API's Redis entries are
cleared on every write. Copy that counted the services ("Six disciplines") now
counts what is published.

### 2.22 The media centre has a front page, five categories, and a place in the header

The client's spec has a Media Centre — news, articles, press releases, project
updates, thought leadership, industry insights and company announcements, with
search and category filters — arranged as Media → News, Videos, Gallery,
Articles. The site had `/news` with three categories, and Media was missing
from the header.

**Five categories, and the old names still work.** `src/lib/news-categories.ts`
holds the list — `press_release`, `project_update`, `thought_leadership`,
`industry_insight`, `company_announcement` — with their labels, and has no
imports so the public pages, the console and the API share it. Two launch
values were the same things under shorter names, so they are mapped rather
than refused: `update` is a project update and `announcement` a company
announcement. The mapping is applied wherever a category arrives — the API
body and query string (`/news?category=update` links shared before the rename
still select the right pill), `/api/news/by-category/update`, the CMS sync and
the repository's writes — and the serializer reads any stray stored value the
same way. Other spellings of the five ("Press release", `press-release`) are
folded in too.

**Migration 0018 renames the stored rows; the column stays free text.** The
category was never enforced in the database, but several readers compare it
exactly — the category facet, related-article ranking, the search filters
(Meilisearch and PostgreSQL) — and would have split a category in two. The
migration rewrites the two old values once, with the `updated_at` trigger held
off so no article claims an edit it never had. There is no CHECK constraint:
the CMS may send a category of its own, and the console already keeps such a
value selectable rather than discarding it, so the API still accepts and
stores one as sent. Only the five are offered in the editor. After deploying,
run `npm run search:reindex` if Meilisearch is configured, so its copies carry
the new names; the facet cache expires on its own.

**`/media` is the section's front page; `/news` stays the list.** `/media` is
server-rendered (`export const revalidate = 60`) from one query
(`news.latestPerCategory`, a window function rather than five round trips):
the newest three published articles in each category, in the order above, each
row linking to that category's filtered list on `/news`. Articles with no
category, or a CMS one, share a final "More news" row. A category with nothing
published is left out, and with nothing at all — or no database, as in the
build — the page shows its empty state, never a 500 (`app/media/load-media.ts`
returns an empty list and logs). Above the rows, four cards open the
collections: news and articles (`/news`), the video library (`/videos`), the
image gallery (`/gallery`) and downloads (`/resources`); the page closes with
the press desk, which goes to `/contact`. `/news` keeps its client-side list
(§2.9); its pills are now the five in order, shown when a category has
something published or is the one selected, followed by any CMS category.

**Breadcrumbs place everything under Media.** `/media` is Home / Media;
`/news` is Home / Media / News & articles; an article is Home / Media / News &
articles / its title (it had a trail before, but its Media crumb went to
`/news`). The header marks Media as current on all three.

**The header has eight links, and Contact is the button.** The spec allows
eight or nine top-level items. Media and Careers were added; Contact was not,
because "Discuss your project" — the header's orange button, non-negotiable in
the handover — already goes to `/contact`, and a Contact link beside it would
be the same destination twice. With eight links the inline nav (from 1081px)
leaves 136px between the logo and the first link at 1081px and 123px from
1181px, where the type steps up; a ninth link would leave about 40px there,
which reads as crowded. The phone menu takes the eight and the button without
scrolling at 390×844.

**Footer and utility links point at the new pages.** Resources is News &
insights, Video library (`/videos`), Image gallery (`/gallery`), Downloads
(`/resources`, previously unlinked) and FAQs; the utility strip's YouTube link
goes to `/videos` instead of `/leadership#video-library`. Those three pages are
built separately; this change only links to them.

### 2.23 The video library is managed in the console, and loads nothing from YouTube until play

The client's spec asks for a video library tied to the official YouTube
channel: seven categories (project documentaries, construction updates, drone
videos, leadership interviews, educational, corporate, event highlights),
thumbnails, search and filters, related videos, and films that link back to
their project. Until now there was a still placeholder in the leadership
page's "Video library" band. `/videos` and `/videos/[slug]` are the library,
managed at `/admin/videos` behind a new `videos:write` permission (admin and
editor; deleting is admin-only, like services). Public reads are `/api/videos`
(category, project and text filters) and `/api/videos/[slug]`; every write is
audited and clears the `videos` cache keys.

**A row is a pointer, not a copy.** Migration 0019 adds `videos` with the
11-character YouTube ID, never a link or embed code: the API takes whatever
form of link an editor pastes, keeps the ID with the homepage's rule
(`src/lib/youtube.ts`, so a channel, playlist or another site is a 422), and
the embed is rebuilt from it on `youtube-nocookie.com`. A film can point at
one project (`ON DELETE SET NULL`), and is linked from the public site only
while that project is live. The project's Passport timeline links from 0012
are left alone: those are evidence attached to the record, and a library film
is editorial content with its own page and order.

**No YouTube thumbnails, anywhere.** `i.ytimg.com` would have been the easy
way to "automatically display thumbnails", but it is a request to Google for
every card on the page, before the visitor has chosen to watch anything — the
thing §2.17 and §2.19 were built to avoid, and on an index of a dozen films
it is a dozen of them. Each card instead shows the editor's own https
thumbnail if one is set, else the linked project's photograph, else a house
still, with a play badge drawn over it. That is still automatic for most
films, since most are tied to a project. The player is the homepage's
click-to-load component (`app/home-video.tsx`, which now takes a poster), so
the first request to YouTube is the visitor's press, with the captions note
under it. The console does not preview from YouTube either.

**The index is server-rendered whole and filtered in the browser.** Unlike
`/news` and `/projects` (§2.9), a library is a few dozen films, so the page
renders every published one and narrows them on the client. The page stays
prerendered and regenerates once a minute, works with JavaScript off (every
film listed), and a filter is instant. The filters still mirror the query
string (`?category=drone&project=…&q=…`), read after mount rather than through
`useSearchParams`, which would make the page dynamic. The API's filters do the
same job for other clients, with pagination. Without a database the page says
the library could not be loaded rather than that it is empty.

**The first featured film leads.** Editors can feature several; the page takes
the first, published, in the console's order, and the first film otherwise.
Related videos are the same live project's first, then the same category's,
up to three. The leadership page's band shows the three latest leadership
interviews by recording date, or a card into the library while there are
none; the `#video-library` anchor the footer and header use still lands on it.
Each project page lists its published films in a compact "Videos" block,
left out when there are none, and a failure to read them hides the block
rather than the page.

The channel's own URL is still unconfirmed (the header's "YouTube" link goes
to the library for that reason), so the library links each film's watch page
but not the channel.

### 2.25 Resources and downloads, and the contact page's gaps

The client's spec asks for a Resources section — company profile, capability
statement, brochures, FAQs, policies and a download centre — with
downloadable project profiles on project pages and download activity tracked
as a business metric; and for the Contact page to carry an enquiry type
(contact, partnership, general), a CAPTCHA, and details the business can
change. Before this, the footer's "Downloads" entry had no page and a project
had one `brochure_url`.

**Documents are their own table** (migration 0021, `documents`): title, slug,
description, a category (company profile, capability statement, brochure,
project profile, policy, other), the file's URL, its UploadThing key when it
was uploaded, its type and size, an optional project, published, sort order
and a download count. `/admin/downloads` manages them behind a new
`downloads:write` permission (admin and editor; deleting is admin-only, as for
tours and services), and every write is audited and clears the `documents`
cache. A document on a project is listed on that project's page as well as on
`/resources`; it stays off both while its project is unpublished, so a project
profile cannot reveal a draft. The project's existing `brochure_url` button is
untouched: a brochure can move into the download centre at an editor's pace.

**A file is an upload or a link.** Uploads are PDFs only, up to 32 MB, through
a new UploadThing route (`document`) authorised exactly as `tourModel` is, and
registered by key only once storage confirms the file — so a document can
never point at an upload that did not finish (§2.2). A link must be https; its
type is read from its extension and its size is left unknown rather than
guessed, so the page shows "PDF" without a size for it. Replacing an uploaded
file, or deleting its document, deletes the stored file.

**Downloads are counted, and nothing about the person is.** Every download
link on the site is `/api/documents/[id]/download`, which adds one to the
document's total and to that day's count (`document_download_days`, a date and
a number) and redirects to the file. No IP address, cookie, identifier or user
agent is stored; the client IP is only the rate limiter's short-lived Redis
key, as on every endpoint, on its own bucket of 30 per 10 minutes. The redirect
is `no-store`, so neither a browser nor the CDN can serve it without counting.
Self-declared crawlers are redirected but not counted, and the links are
`rel="nofollow"`. A download does not move the row's `updated_at` (the trigger
is skipped when only the count changes), so "last edited" keeps its meaning.
The console shows each document's total and its last 30 days. The privacy
policy needed no change for this: nothing personal is processed.

**`/resources` is one page**, regenerated at most once a minute and empty-but-
honest without a database: the download centre grouped by category, each file
with its type and size; the way to `/faqs`; and the policies — the site's four
legal pages, plus any document published in the policy category. `/downloads`
redirects there. `components/site.ts` was owned by another change this round,
so **the footer's "Downloads" entry still has no link**: it should become
`{ label: 'Downloads', href: '/resources' }`.

**The enquiry type replaced the free-text subject list**, so the form gained
no field: general, a new project, partnership, contractors and suppliers,
media, careers, or a question about a project record. It is stored with the
submission (`metadata.enquiryType`; one from before reads as general), leads
the staff email's subject line, and is shown and filterable in the inbox. The
contact page's routes each link into the form with their type chosen
(`/contact?type=partnership#enquiry`), which is how "Partnership enquiry" and
"General enquiry" are reached without three forms to maintain.

**The CAPTCHA is Cloudflare Turnstile**, because Cloudflare already fronts the
site and is a listed processor, and because it usually passes without a puzzle.
It is inert until `TURNSTILE_SECRET_KEY` and a site key
(`NEXT_PUBLIC_TURNSTILE_SITE_KEY` or `TURNSTILE_SITE_KEY`) are set; set them
together. Then it fails closed: no token is a 422, a refused token a 400, and
Cloudflare unreachable a 503, and nothing is stored for any of them — a check
that waves things through when unsure is not a check. Cloudflare's script is
requested only on `/contact`, from a plain script tag (no new dependency), and
the report-only CSP now allows it in `script-src`; `frame-src https:` already
covered its frame. The honeypot, the heuristic score and Akismet still run
behind it. The privacy policy's Cloudflare entry now says what Turnstile reads.
It was checked in a browser with Cloudflare's always-pass test keys (widget,
token, server verification, enquiry stored); the failure paths are covered by
tests against a mocked siteverify.

**Contact details are a `contact` document in `site_settings`** (no
migration), edited at `/admin/contact` under the existing `settings:write`
permission and audited like the homepage's: the address lines, up to four
phone numbers and email addresses (each labelled), the WhatsApp Business
number (blank hides WhatsApp), business hours as day/hours pairs, and the
map's position. The last makes §2.17's map switchable from the console: once
CoBuilt confirms the coordinates, an administrator enters them and the
click-to-load OpenStreetMap appears. A key never saved — or no database —
shows the constants in `components/site.ts`, which a unit test holds the
fallback to. **The header, footer and the landing page's tap-to-call read the
same document**: the root layout loads it on the server and hands it to them
through `components/ContactDetails.tsx`, so the layout sets a one-minute
`revalidate` and a change at `/admin/contact` shows site-wide within the
minute. The legal pages keep quoting the built-in address in their text.

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
