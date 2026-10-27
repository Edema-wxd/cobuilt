# CoBuilt — design handover

What still needs designing on the CoBuilt Investment Partners website, the rules
those designs have to hold to, and the data each page can actually show.

Sixteen pages are live: the landing page, the projects index, a project detail
page, a project's Passport record, About, Leadership, Services and the six
service pages behind it, Passport™, the media centre and its article page,
Contact, Careers, and four legal pages. The backend covers more still — 41 API
routes, several with no interface yet. This document is the list of what to
design next, in the order worth building.

**Reference:** Var-2026-003, Phase 1 · **Direction:** 3c, "Corporate Digital
Standards" · **Stack for implementation:** Next.js App Router for pages, pages
router for the API, Tailwind v4. (This document originally specified the pages
router throughout; the pages were migrated to the App Router — see
`docs/decisions.md` §2.12.)

---

## 1. Non-negotiables

These come from the client's standards document and from Nigerian regulation.
They are not style preferences, and a design that breaks one will be sent back.

**No investment call to action, anywhere.** CoBuilt is not licensed to offer or
solicit investment yet. Every investor-facing path resolves to "Register your
interest" — never "Invest", "Buy", "Get returns" or a figure presented as an
offer. An Investor Portal exists in the architecture, marked pending licensing.
Where a page touches investment, it carries the regulatory notice: *"This is an
information request only… An Investor Portal will be introduced once all
required regulatory approvals and licences are in place."*

**The header navigation, in this order:** Home, About, Leadership,
Services, Projects, Passport™. Media, Careers and Contact are deliberately
left out of the header (Careers stays in the footer). The header also carries
a "Discuss your project" button and a search entry point.

**Tagline:** "Building Trust Through Every Brick". It is not editable copy.

**WCAG 2.2 AA.** The site links to its own accessibility statement, so it has to
hold. Every interactive control is at least 44×44px. Contrast pairings are
verified by an automated test that fails the build, so a design that puts white
on orange cannot ship — see §2.

**Project Passport™ is the product.** The whole brief rests on one claim: every
development carries a permanent, public record from commencement to handover.
Passport pages are the proof. They should feel like a record — dated, factual,
verifiable — not like marketing.

---

## 2. The design system as built

The landing page is the reference implementation. Reuse it rather than inventing
new patterns; where you need something new, say so explicitly in the handback.

### Colour

Orange is a **background**, never text on a light ground. This is the single
most common way to break the build.

| Token | Value | Use |
|---|---|---|
| `orange` | `#FF6600` | Fills and bands only. Labels on it are charcoal (`ink`), never white — white on orange is 2.94:1 and fails at every size. |
| `orange-lift` | `#E65C00` | Hover for orange fills. |
| `orange-on-dark` | `#FF9955` | Accent text on charcoal only. |
| `rust` | `#B34700` | Accent text on white or light grey — eyebrows, links, step numerals, progress fill. |
| `rust-hover` | `#8F3900` | Hover for rust text. |
| `ink` | `#1C1C1C` | Body text, dark sections, footer. |
| `ink-deep` | `#141414` | Legal bar, and panels over photography. |
| `zinc-700 → zinc-50` | | Neutral ramp for body copy, meta text and muted grounds. |
| `line` | `#E6E6E6` | Hairlines, card borders, and the "register" section ground. |
| `line-on-dark` | `white / 18%` | Hairlines on charcoal. |

Text over photography needs its own ground: either a scrim dark enough to hold
4.5:1, or a solid panel. The hero's phone block uses an 80% `ink-deep` tile for
exactly this reason.

### Type

**Geist** throughout, **Geist Mono** for record-like data only: project IDs,
milestone numbers, step numerals, dates in a legal context.

- Headings run **light (300)**, tight (`-0.035em`, line-height 1.08), with an
  italic 400 `<em>` carrying one accent phrase. At 40px+ the 300 weight reads
  editorial rather than promotional — that is the register of this brand.
- Section titles are fluid: `clamp(1.875rem, 3.4vw, 2.75rem)` large,
  `clamp(1.75rem, 3vw, 2.5rem)` medium, `clamp(1.5rem, 2.4vw, 2.125rem)` small.
- Eyebrows: 11.5px, uppercase, `0.28em` tracking, rust (or `orange-on-dark`).
- Body copy: 16px at 1.8 line-height. Meta and card text: 14–14.5px at 1.7.
- Buttons and small links: 11.5px, uppercase, 600, `0.16em` tracking.
- Prose pages hold a 760px measure; the landing page holds 1160px with a fluid
  gutter of `clamp(20px, 4vw, 44px)`.

### Layout and breakpoints

Mobile-first. The layout changes at **641px**, **901px** and **1081px** (where
the full nav fits inline). Design at phone width first — that is where most of
this audience is, and where the previous round of fixes was spent.

Corners are square everywhere (`border-radius: 0`), except the video play
button. Cards are separated by 1px hairlines over a grey ground rather than by
shadows. There is one shadow on the site (the cookie banner) and one animation
(the wordmark marquee, hidden on phones).

### Motion

Effectively none, deliberately. Colour transitions on hover at 150ms, and the
marquee. No scroll-triggered reveals, no card hover lifts. `prefers-reduced-motion`
stops the marquee outright. Keep it that way unless a new page has a genuine
reason.

### Components that already exist

Header with disclosure menu · utility strip · footer with four link columns ·
legal bar · cookie banner with per-category panel · buttons (orange, white,
outline-on-dark, outline) · eyebrow · stat band · service card grid · project
card with status badge and progress bar · filter pills (scrolling row on
phones) · milestone list · value/step columns with dividing rules · news card ·
form fields with NDPA consent · regulatory notice block · prose page shell with
section rules, tables and note blocks.

---

## 3. Pages to design

Ordered by build sequence. For each, the data listed is what the API already
returns — designing for fields that do not exist creates backend work, so flag
it if a page needs more.

### Tier 1 — the landing page already promises these

This tier is **done**, and so is the Tier 2 navigation below it except for
search. The fifteen links on the home page that jumped to an on-page anchor now
reach the page they promise, and the two anchors that remain — "Explore our
projects" and "Register your interest" — are genuine on-page destinations. The
nav's six anchor items are pages; see `docs/decisions.md` §2.15 for what each
one is built from and which links were pointed elsewhere rather than invented.

Tier 1 is complete: the tour viewer (§3.7) and search autocomplete (§3.5) are built.

#### 3.1 Project Passport™ — `/projects/[slug]/passport` — **built**

The most important page on the site. A public, permanent record of one
development, milestone by milestone.

Implemented in `app/projects/[slug]/passport/`. Server-rendered with no client
JavaScript, so the whole record is in the HTML as served. See
docs/decisions.md §2.14 for what that shapes, and for the three fields the data
does not carry.

Available per milestone: type (commencement, foundation, superstructure,
roofing, MEP, finishes, practical completion, handover, or custom), title,
description, scheduled date, **actual date**, status (pending, in progress,
completed, delayed), photo URLs, document URLs, video URL, and the timestamp the
entry was recorded. Plus project-level progress: total, completed, percent.

How the design questions this section posed were resolved:

- **A delayed milestone** keeps the outlined chip the project page uses, not a
  red one. Both dates are always shown — "Scheduled for" beside "Met on" — and
  the variance is stated in words beneath them ("5 days later than scheduled").
  A milestone reported delayed with no actual date says the scheduled date
  stands as published and has not been revised. The count of delayed milestones
  is disclosed in the progress band above the record, not left to be found.
- **A milestone with photography** carries a 2-to-4-up tile grid under its
  description, captioned with the count. One with only a date is the same entry
  without that block: the dates and the provenance line are the entry's spine,
  and everything else is optional around them.
- **Attached documents** are a row of bordered links, each naming the document
  and its file type, opening in a new tab. The name is read from the URL's last
  segment because there is no title column.
- **Provenance** is the project ID on the hero's mono rule, a six-cell record
  summary above the entries, and a mono line closing every entry: the entry's
  number, when it was written into the record, and when it was revised if it
  was. Times are in West Africa Time, which is stated.
- **Empty state**: built, and so is the state for a project whose Passport is
  not open at all — that one answers rather than 404s, and is `noindex`.

#### 3.2 Project detail — `/projects/[slug]` — **built**

Implemented at `pages/projects/[slug].tsx`, from the "CoBuilt Project Detail"
mockup. Both investor states are built, the tour entry and its fallback are
built, and so is the viewer itself (3.7). See docs/decisions.md §2.10.

Available: title, description, long description, status, project type, location,
sector, featured image, gallery, related services, tags, passport start date and
completion target, passport progress with the **next milestone**, and SEO
fields. An `investor` block (amount, expected ROI, highlights) exists but is
**null until legal approves it per project** — design for both states, and
remember §1: no investment CTA even when it is populated.

Also available: 3D virtual tours (see 3.7).

#### 3.3 Projects index — `/projects` — **built**

Implemented at `app/projects/`. Filterable by status, type, location, sector and tag; sortable by recent, title
or oldest; paginated; free-text searchable. The home page's All/Past/Ongoing/
Future pills are the starting point, but this page needs to carry more filters
than those four — decide how they behave on a phone, where the existing pills
already scroll horizontally.

Needs an empty state ("no projects match these filters") and a loading state.

#### 3.4 News & insights — `/news`, `/news/[slug]` — **built**

Implemented at `app/news/`. The index reads `/api/news` on the client, with
category pills from `/api/search/facets?type=news`, free-text search,
pagination and designed loading, empty and error states; the article page is
server-rendered for its SEO fields and link previews, with related articles
from the repository's tag-overlap ranking.

`/news/category/[category]` is deliberately not a route: the category is a
filter on the index (`/news?category=update`), so there is one list and one
empty state. The API route of that name is untouched.

The article prose style is `components/ArticleBody.tsx` — a 760px measure at
17px, airier than the legal pages. It renders CMS text without
`dangerouslySetInnerHTML`: tags are stripped to their text and a Markdown
subset (headings, lists, quotes) is honoured. Images with captions and pull
quotes are **not** yet designed, because nothing in `content` distinguishes
them; that is a CMS question (§5.1) before it is a design one. See
`docs/decisions.md` §2.15.

#### 3.5 Search — `/search` — **built**, with autocomplete

The header's search entry currently goes nowhere. The API returns results across
**projects, news and FAQs**, each with type, title, excerpt, URL and published
date, plus facets and autocomplete.

Design: the search entry itself (it is currently a text link in the utility
strip), the results page with result types distinguished, facet filtering, the
autocomplete dropdown, and the no-results state. Note the response says which
engine answered; that is diagnostic, not something to show visitors.

#### 3.6 Contact — `/contact` — **built**

Implemented at `app/contact/`. Posts to `/api/forms/inquiry` — a different
endpoint, and a different thing, from the landing page's newsletter band, which
is what "Contact" in the nav used to point at. Carries the office address and
hours, the phone line, email and WhatsApp Business, the four routes an enquiry
can take, and the NDPA position on what happens to the details.

The form's success state replaces the form rather than sitting under it, so a
sent enquiry cannot be resubmitted by habit; the failure states distinguish a
rate limit, a 5xx and a rejected field.

**Map: built, waiting on a location.** A click-to-load OpenStreetMap panel sits
under the address. Nothing is requested from the map server until the visitor
asks. It stays hidden until CoBuilt confirms the office's coordinates, because
the published address does not geocode. See docs/decisions.md §2.17.

#### 3.7 3D virtual tours — **built**

Phase 1 scope names virtual tours explicitly, and the API supports three
formats: a Three.js model, a Matterport embed, and a custom viewer. Each project
can carry several, one of them featured.

How each open question was resolved (docs/decisions.md §2.16):

- **Entry**: "Enter the virtual tour" in the project hero jumps to the tours
  band. The featured tour is preselected, and "Enter the tour" sits over its
  thumbnail with the download size.
- **Chrome**: a bar naming the tour, with Fullscreen (only where the browser
  supports it) and Exit tour. Escape exits too. The tour list beside the viewer
  switches tours. A model adds "Reset view" and a one-line controls hint.
- **Heavy model**: a real progress bar ("Downloading · 34% of 48 MB"), then
  "Preparing the model…", with Cancel throughout. On a low-memory device or
  with data saver on, a large model asks first: "This is a large model", with
  Load anyway, View gallery and Back.
- **Fallback**: four distinct explanations (no 3D support, download failed,
  unreadable file, device out of graphics memory). Each offers the gallery and
  Back, and the download failure also offers Try again.

### Tier 2 — mandated by the navigation

These are nav or footer items that currently point at a homepage anchor or
nothing at all.

- **`/about`** — **built.** The integrated model as eight stages, the four
  standing obligations behind "documented delivery", the values, and the stat
  band. No company history: nobody has supplied dated facts, and inventing a
  founding story on a site about documented delivery is the one thing this page
  cannot do. It is a page section away when the client provides it.
- **`/leadership`** — **built.** Profile cards with a remit, the philosophy as
  four management rules, and the video library the footer links to
  (`/leadership#video-library`). The portrait slot still says what it is waiting
  for rather than holding a stock face, and the roles whose profiles are
  unapproved are listed honestly in a card of the same shape — see §5.2. The
  treatment is built; the content drops in.
- **`/services` and `/services/[slug]`** — **built.** Six pages generated from
  `app/services/services.ts`, which the landing page's own card grid now reads
  too, so the two cannot drift. Property Investment stays informational: no call
  to action, the licensing notice above the fold, and its closing band offers
  only registration.
- **Passport™ — `/passport`** — **built.** The nav item's explainer: what a
  Passport is, the eight mandatory entries, the four milestone states with
  "delayed" treated as a fact rather than an alarm, what evidence attaches, and
  how to read the provenance. The record itself is §3.1.
- **Media — `/news`** — **built**; see §3.4.
- **Contact — `/contact`** — **built**; see §3.6.
- **`/governance`** — in the footer with no page behind it. Given the brand
  position, this one matters more than it looks.
- **`/downloads`** — company profile, brochures, certificates. Needs a file list
  pattern with type and size.
- **`/faqs`** — **built.** Grouped by category, each entry a native disclosure with a stable `#id` anchor that search results link to. Read from the new `GET /api/faqs`.
- **Investor information** — where the regulatory position lives in full. No
  call to action beyond registering interest.

### Tier 3 — accounts and admin

Complete APIs, no interface at all. Lower priority for public launch, but the
admin console is what makes the site maintainable without a developer.

- **Accounts** — **built.** Sign in (`/admin/sign-in`), forgot and reset
  password (`/admin/forgot-password`, `/admin/reset-password` — the target of
  the reset email), and `/admin/account`, which carries the NDPA rights the
  privacy policy promises: data export and account deletion. The account page
  opens for every role, including those with no console permission. Phase 1
  has no public sign-up, so admins create accounts at `/admin/users/new`;
  `/admin/register` says accounts are by invitation. The first admin in a
  fresh environment is invited with `npm run user:invite-admin`.
- **Admin console — `/admin` — built.** Overview with analytics, submissions
  inbox (spam flagging, masked contact details), projects (list, create, edit,
  delete), Passport™ milestones per project, news (list, create, edit, delete),
  3D tours (upload, edit, delete), investor-content approval, users and roles,
  and the audit log. Editors send only the fields that changed, and any change
  to an investor figure withdraws its approval after a confirmation. A record
  mirrored from the CMS carries a notice that the CMS will overwrite console
  edits. Gallery albums are still attached only from the CMS.

### Small gaps worth folding in

- **404 and 500 pages** — visitors currently get the unstyled Next.js default.
  More routes now call `notFound()` — an unknown service slug, an unknown
  article — so this is more visible than it was.
- **Social preview images** — **built.** A branded card per page, and an item's own photography wins where it has some. See docs/decisions.md §2.18.
- **A video library page** — the footer links to one; the home page has a still.

---

## 4. Cross-cutting patterns to define once

- **Loading and empty states.** The live site has none, because every page is
  static. Every Tier 1 page reads from an API that can be slow, empty or down.
- **Error states.** The site degrades rather than failing: search falls back to
  PostgreSQL, images may be missing. Design for a missing featured image.
- **Pagination.** Every list endpoint is paginated; no pattern exists yet.
- **Forms.** The register form is the reference: label above field, 44px+ targets,
  16px text on phones (smaller zooms the page on iOS), NDPA consent checkbox,
  inline status message. Reuse it for enquiry, auth and admin forms.
- **Breadcrumbs.** Passport sits three levels deep. `components/PageHero.tsx`
  takes a `trail`, and the record uses it: Home / Projects / {project} / Passport™.

---

## 5. Open questions — answers needed before some of this is buildable

1. **Who supplies the content?** A CMS (Strapi assumed, not confirmed) is meant
   to feed projects and news. Until that is settled, page designs should not
   assume field types that do not exist.
2. **Photography.** Leadership portraits and real project imagery are both
   placeholders today. Passport pages in particular depend on site photography
   that someone has to be shooting on a schedule.
3. **How much of a milestone is public?** Documents and photos can attach to
   every milestone. Where the line sits between public record and internal
   record is a client decision with a direct design consequence.
4. **Investor content approval.** The gate is built and audited; the approving
   role is currently `admin`. If legal sign-off belongs to a distinct role, that
   changes the admin console design.
5. **Does Phase 1 include the admin console**, or is content managed in the CMS
   with the admin API reserved for later? This decides whether Tier 3 is in
   scope now.

---

## 6. Where things are

- Live reference: the landing page, `pages/index.tsx`.
- Design tokens and base styles: `styles/globals.css`.
- Shared class strings: `components/ui.ts`, `components/prose.ts`.
- Navigation and footer content: `components/site.ts`.
- API contract, with every field and response shape: `docs/openapi.yaml`.
- Decisions, deviations and deferrals: `docs/decisions.md`.
- Contrast rules as an executable test: `__tests__/unit/contrast.test.ts`.
