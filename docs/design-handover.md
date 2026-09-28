# CoBuilt — design handover

What still needs designing on the CoBuilt Investment Partners website, the rules
those designs have to hold to, and the data each page can actually show.

Eight pages are live: the landing page, the projects index, a project detail
page, Careers, and four legal pages. The backend
covers far more than that — 41 API routes, most with no interface yet. This
document is the list of what to design next, in the order worth building.

**Reference:** Var-2026-003, Phase 1 · **Direction:** 3c, "Corporate Digital
Standards" · **Stack for implementation:** Next.js pages router, Tailwind v4.

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

**The nine-item global navigation, in this order:** Home, About, Leadership,
Services, Projects, Passport™, Media, Careers, Contact. The header also carries
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

Fifteen links on the live home page currently jump to an on-page anchor because
the page they mean does not exist. Eight of them — "Contact us", the five
"Learn more →" service links, "Explore all projects" and "More news" — land on
the newsletter form,
which is not what any of them promise.

#### 3.1 Project Passport™ — `/projects/[slug]/passport`

The most important page on the site. A public, permanent record of one
development, milestone by milestone.

Available per milestone: type (commencement, foundation, superstructure,
roofing, MEP, finishes, practical completion, handover, or custom), title,
description, scheduled date, **actual date**, status (pending, in progress,
completed, delayed), photo URLs, document URLs, video URL, and the timestamp the
entry was recorded. Plus project-level progress: total, completed, percent.

Design questions worth resolving here:

- How a **delayed** milestone reads. The brand promise is that a slipped date is
  reported rather than quietly revised, so "delayed" has to be legible without
  looking like a failure state. Scheduled vs actual date should both be visible.
- What a milestone with photography looks like versus one with only a date.
- How attached documents (certificates, reports) are presented and downloaded.
- The record's provenance: this page's credibility rests on looking like an
  archive. Consider how the recorded-at timestamp and project ID are shown.
- Empty state: a project whose passport is enabled but has no milestones yet.

#### 3.2 Project detail — `/projects/[slug]` — **built**

Implemented at `pages/projects/[slug].tsx`, from the "CoBuilt Project Detail"
mockup. Both investor states are built, the tour entry and its fallback are
built, and the viewer itself is still open (3.7). See docs/decisions.md §2.10.

Available: title, description, long description, status, project type, location,
sector, featured image, gallery, related services, tags, passport start date and
completion target, passport progress with the **next milestone**, and SEO
fields. An `investor` block (amount, expected ROI, highlights) exists but is
**null until legal approves it per project** — design for both states, and
remember §1: no investment CTA even when it is populated.

Also available: 3D virtual tours (see 3.7).

#### 3.3 Projects index — `/projects`

Filterable by status, type, location, sector and tag; sortable by recent, title
or oldest; paginated; free-text searchable. The home page's All/Past/Ongoing/
Future pills are the starting point, but this page needs to carry more filters
than those four — decide how they behave on a phone, where the existing pills
already scroll horizontally.

Needs an empty state ("no projects match these filters") and a loading state.

#### 3.4 News & insights — `/news`, `/news/[slug]`, `/news/category/[category]`

Available: title, excerpt, category, tags, author, published date, featured
image, and full content for the article. The home page's three-card media
section is the pattern to extend.

The article page needs a designed prose style for CMS-authored content —
headings, lists, pull quotes, images with captions, links. The legal pages have
a prose style already, but they are dense and formal; an article probably wants
more air.

#### 3.5 Search — `/search`

The header's search entry currently goes nowhere. The API returns results across
**projects, news and FAQs**, each with type, title, excerpt, URL and published
date, plus facets and autocomplete.

Design: the search entry itself (it is currently a text link in the utility
strip), the results page with result types distinguished, facet filtering, the
autocomplete dropdown, and the no-results state. Note the response says which
engine answered; that is diagnostic, not something to show visitors.

#### 3.6 Contact — `/contact`

"Contact" in the nav currently points at the newsletter form, which is a
different thing. This page posts to a separate enquiry endpoint: name, email,
phone, subject, message, NDPA consent checkbox.

Needs: the office address and hours (already in the footer), phone, email,
WhatsApp Business, and success and failure states for the form. Whether to show
a map is an open question — there is no map integration in the build.

#### 3.7 3D virtual tours

Phase 1 scope names virtual tours explicitly, and the API supports three
formats: a Three.js model, a Matterport embed, and a custom viewer. Each project
can carry several, one of them featured.

Design needed for: how a tour is entered from a project page, the viewer chrome
(fullscreen, exit, tour switching), the loading state for a heavy model, and the
fallback when a tour fails or the device cannot handle it.

### Tier 2 — mandated by the navigation

These are nav or footer items that currently point at a homepage anchor or
nothing at all.

- **`/about`** — the story behind "documented delivery": the integrated model
  (land acquisition through asset management), history, and the Passport
  commitment.
- **`/leadership`** — the home page shows a grey placeholder box where a
  portrait belongs. Needs a real treatment for leadership profiles, plus the
  video library that the footer links to.
- **`/services` and `/services/[slug]`** — six disciplines, each with a "Learn
  more →" link that currently goes to the newsletter form. Note the sixth,
  Property Investment, is marked **informational only** and must stay that way.
- **`/governance`** — in the footer with no page behind it. Given the brand
  position, this one matters more than it looks.
- **`/downloads`** — company profile, brochures, certificates. Needs a file list
  pattern with type and size.
- **`/faqs`** — FAQs are already a searchable content type in the API.
- **Investor information** — where the regulatory position lives in full. No
  call to action beyond registering interest.

### Tier 3 — accounts and admin

Complete APIs, no interface at all. Lower priority for public launch, but the
admin console is what makes the site maintainable without a developer.

- **Accounts:** sign in, register, forgot password, reset password, and an
  account page. The account page must carry NDPA rights — data export and
  account deletion both exist as endpoints and are promised in the privacy
  policy.
- **Admin console:** dashboard, form submissions inbox (with spam flagging and
  masked contact details), users and roles, 3D tour uploads, investor-content
  approval, audit log, and analytics. Thirteen endpoints, no screens. This can
  be plainer than the public site, but it should still be recognisably CoBuilt.

### Small gaps worth folding in

- **404 and 500 pages** — visitors currently get the unstyled Next.js default.
- **Social preview images** — nothing exists for link sharing.
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
- **Breadcrumbs.** Passport sits three levels deep; there is no wayfinding yet.

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
