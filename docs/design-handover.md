# CoBuilt — design handover

What still needs designing on the CoBuilt Investment Partners website, the rules
those designs have to hold to, and the data each page can actually show.

Seventeen pages are live: the landing page, the projects index, a project detail
page, a project's Passport record, About, Leadership, Services and the six
service pages behind it, Passport™, the media centre (`/media`), its news list
and article page, the image gallery and its album pages, Contact, Careers,
and four legal pages. The backend covers more still — 41 API
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
Services, Projects, Passport™, Media, Careers — eight links, inside the spec's
eight-to-nine. Contact is the header's "Discuss your project" button, which
goes to `/contact`, rather than a ninth link beside it; a ninth item would
crowd the inline nav at 1081px (`docs/decisions.md` §2.22). The header also
carries a search entry point.

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
shadows. There is one shadow on the site (the cookie banner).

### Motion

Restrained and entrance-only: things arrive, they do not perform. One easing
(`--ease-settle`, quick off the mark with a long soft landing) and one
movement (a 20px rise with a fade) carry almost all of it. Everything is
defined in `styles/globals.css`.

- **Brand mark** (`components/BrandIntro.tsx`): on the first page of a visit
  the CoBuilt logo and a small running-bond wall of orange bricks cover the
  page for about a second, then lift away. Later pages in the same visit skip
  it. Pure CSS, so it clears even if the page never hydrates.
- **Page header** (`intro`): eyebrow, heading, standfirst and actions rise in
  one after another on load, 90ms apart. Hero photographs settle from a slight
  zoom (`settle`). On the home page that zoom wraps the hero video and its
  poster.
- **Sections** (`reveal`, `reveal-stagger`): section heads, card grids, value
  and step rows rise in once as they scroll into view; in a `reveal-stagger`
  the children follow one another. Hairline card grids rise as one block, since
  staggering them shows the grey ground. Driven by
  `components/MotionObserver.tsx`, which also catches content that loads later
  (filtered projects, search results).
- **Figures and progress**: the stat bands count up (`components/CountUp.tsx`)
  and project progress bars fill (`reveal-bar`) as they come into view.
- **Hover**: colour transitions at 150ms on links and buttons; card photos ease
  in by 4% inside their frame. Still no card lifts or shadows.
- **Loading**: a 3px orange bar runs along the top of the window while the next
  page loads (`components/NavProgress.tsx`); pages that wait on the database
  show the brick mark laying itself on a loop (`components/PageLoading.tsx`,
  the `loading.tsx` files); list placeholders shimmer (`shimmer`).

The rules that keep it safe: nothing is ever hidden until
`MotionObserver` has marked what is already on screen and switched motion on,
so a page that fails to hydrate, prints, or runs without JavaScript shows
everything. `prefers-reduced-motion` stops all of it outright: no brand mark,
no entrances, no counting, no shimmer. New pages get motion by using the
shared pieces (`PageHero`, `sectionHead`, `cardGrid`, `CtaBand`) or by adding
`reveal` / `reveal-stagger` to a container; do not invent new movements.

### Components that already exist

Header with disclosure menu · utility strip · footer with four link columns ·
legal bar · cookie banner with per-category panel · buttons (orange, white,
outline-on-dark, outline) · eyebrow · stat band · service card grid · project
card with status badge and progress bar · filter pills (scrolling row on
phones) · milestone list · value/step columns with dividing rules · news card · album card ·
full-screen photo viewer (`app/gallery/[slug]/album-viewer.tsx`) ·
form fields with NDPA consent · application form with error summary and CV field (`app/careers/application-form.tsx`) · vacancy card · regulatory notice block · prose page shell with
section rules, tables and note blocks.

---

## 3. Pages to design

Ordered by build sequence. For each, the data listed is what the API already
returns — designing for fields that do not exist creates backend work, so flag
it if a page needs more.

### The landing page — `/` — **built**, partly managed in the console

The reference implementation (§2), cut for conversion on 30 Oct and brought
back to the client's spec on 1 Nov. Top to bottom:

| Section | Source | Hidden when |
|---|---|---|
| Hero: fixed tagline, headline, subheading, "Discuss your project" and "Explore our projects", rotating photography, tap-to-call | Headline and subheading from `/admin/homepage`, else the copy as built | — |
| Stat band: delivered, under development, units, locations | Counted from live projects; units, and any override, from `/admin/homepage`. The pre-database figures (5+, 3, 30+, 5+) show only when there is no database | Every figure is 0 |
| Featured projects, with "Discuss your project" and "Explore all projects" | Three most recently published projects | — (empty state instead) |
| Services | Published services from `/admin/services`, in their order; `app/services/services.ts` when there is no database | None published |
| Project Passport™ explainer | Illustrative milestones | — |
| How it works, with the testimonial and "Contact us" | Static | — |
| Project video | YouTube link and title from `/admin/homepage` | No video set, or switched off |
| Leadership spotlight, "Meet the leadership" | First three published `leadership` rows by sort order | None published, or switched off |
| Latest news, "View all news" | Three most recent published articles | None published, or switched off |
| Register your interest, with the regulatory notice beside the form | — | — |

The three late bands are deliberately compact and come after the case is made;
they alternate grey and white among those shown, so hiding one never sets two
bands of one ground side by side. A fresh database shows hero, projects (empty
state), services, Passport, how it works and the form — a clean page, not a row
of zeros.

**The video loads on request.** The band shows a house still, the title and a
play button; nothing is requested from YouTube, not even a thumbnail, until the
visitor presses play, and the player then comes from `youtube-nocookie.com`
with focus moved into it. The caption says YouTube sees the visitor's IP once
they press play and points to CC for captions; the console asks editors to add
captions before featuring a video. Same rule as the contact map (§3.6).

**What the console can change** (`/admin/homepage`, admin only,
`settings:write`, audited): headline (`*phrase*` sets the accent italic),
subheading, the video link and title, an override per figure (0 hides it; "+"
marks a floor), and on/off for the video, leadership and news bands. Not the
tagline, which is fixed (§1), and not the CTAs: the header's "Discuss your
project" plus the page's three primary actions are the spec's set, and adding
more dilutes them. Changes reach the page at once, and within a minute at worst.

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

Also available: 3D virtual tours (see 3.7), and the project's photo albums
in the image gallery — a compact "Photo albums" band of cards linking into
`/gallery/[slug]`, left out when the project has none (§3.8).

#### 3.3 Projects index — `/projects` — **built**

Implemented at `app/projects/`. Filterable by status, type, location, sector and tag; sortable by recent, title
or oldest; paginated; free-text searchable. The home page's former All/Past/Ongoing/
Future pills are the starting point, but this page needs to carry more filters
than those four — decide how they behave on a phone, where the existing pills
already scroll horizontally.

Needs an empty state ("no projects match these filters") and a loading state.

#### 3.4 Media centre — `/media`, `/news`, `/news/[slug]` — **built**

`/media` (`app/media/`) is the section's front page, as the spec's Media →
News, Videos, Gallery, Articles: four cards opening news and articles
(`/news`), the video library (`/videos`), the image gallery (`/gallery`) and
downloads (`/resources`); then the newest three articles in each category, a
row per category linking to its filtered list; then the press desk, which goes
to `/contact`. Server-rendered and regenerated each minute; a category with
nothing published is left out, and with nothing at all the page shows an
empty state. The video, gallery and download pages are built separately.

Articles have five categories, the spec's: press release, project update,
thought leadership, industry insight and company announcement
(`src/lib/news-categories.ts`). The launch values `update` and `announcement`
are read as project update and company announcement everywhere, including old
`/news?category=update` links. See `docs/decisions.md` §2.22.

`/news` (`app/news/`) reads `/api/news` on the client, with the five category
pills in order (each shown once something is published in it), free-text
search, pagination and designed loading, empty and error states; the article
page is server-rendered for its SEO fields and link previews, with related
articles from the repository's tag-overlap ranking. Breadcrumbs run Home /
Media / News & articles / the article.

`/news/category/[category]` is deliberately not a route: the category is a
filter on the index (`/news?category=project_update`), so there is one list
and one empty state. The API route of that name is untouched.

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

**Enquiry type, CAPTCHA and managed details** (`docs/decisions.md` §2.25).
"Type of enquiry" (general, new project, partnership, contractors and
suppliers, media, careers, a project record) replaced the subject list, so
the form has no more fields than before; each of the six route cards below
the form links into it with its type chosen. When Turnstile keys are set,
Cloudflare's check sits above the send button (usually a tick that passes by
itself), and if its script cannot load the form says so and points to the
phone and email. The address, phone numbers, emails, WhatsApp number,
business hours (now their own block under the address) and the map position
come from `/admin/contact`, and so do the header's phone and email, the
footer's address and hours, and the landing page's tap-to-call line.

**Map: built, waiting on a location.** A click-to-load OpenStreetMap panel sits
under the address. Nothing is requested from the map server until the visitor
asks. It stays hidden until CoBuilt confirms the office's coordinates, because
the published address does not geocode; an administrator can now enter them
at `/admin/contact`. See docs/decisions.md §2.17.

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

#### 3.8 Image gallery — `/gallery`, `/gallery/[slug]` — **built**

Albums managed and uploaded at `/admin/gallery`, organised by the client's six
categories: completed projects, ongoing projects, future concepts, events, team
activities, corporate branding. See `docs/decisions.md` §2.24.

- **Index**: the album grid (cover, category eyebrow, title, a two-line
  description, photograph count and project), with category pills — the
  projects index's pattern, one scrolling row on a phone — and a project
  select. Only filters with albums behind them are offered, each with its
  count. Filtering is instant and kept in the query string. Empty and "no
  match" states are built, and so is the state for a database that is down.
- **Album**: the hero carries the category, title, description and a mono rule
  with the count and the project's link, under breadcrumbs (Home / Gallery /
  album). Photographs sit in fixed 4:3 tiles, two to four across, with the
  caption beneath where there is one.
- **Viewer**: full screen on `ink-deep`, so white text needs no scrim. A bar
  with the album's title, "3 / 12" and a close button; previous and next at
  the sides; the caption and date taken in a band beneath. Keyboard (arrows,
  Home, End, Escape), swipe, and focus held inside it; all controls 48px.
- **Data**: per album, title, description, category, project, cover and
  count; per image, URL, **alt text (required)**, caption, pixel size and
  date taken. There is no photographer credit or licence field — say if the
  client needs one.
- Not in the header navigation (§1); the footer's media links are the way in,
  and each project page links its albums.

### Tier 2 — mandated by the navigation

These are nav or footer items that currently point at a homepage anchor or
nothing at all.

- **`/about`** — **built.** The integrated model as eight stages, the four
  standing obligations behind "documented delivery", the values, and the stat
  band. No company history: nobody has supplied dated facts, and inventing a
  founding story on a site about documented delivery is the one thing this page
  cannot do. It is a page section away when the client provides it.
- **`/leadership`** — **built.** Profile cards with a remit, the philosophy as
  four management rules, and a video band (`/leadership#video-library`): the
  three latest leadership interviews from `/videos`, or a card into the
  library while there are none; the footer and the utility strip's YouTube
  link go to `/videos` itself. The portrait slot still says what it is waiting
  for rather than holding a stock face, and the roles whose profiles are
  unapproved are listed honestly in a card of the same shape — see §5.2. The
  treatment is built; the content drops in. Profiles are now published from
  the admin console (`/admin/leadership`): each card carries the portrait,
  role, short profile, areas of expertise, qualifications and the biography
  (in a disclosure), the page adds the organisational structure by tier, and
  `/leadership/[slug]` is the full profile. With none published the page keeps
  the pending state above. See `docs/decisions.md` §2.20.
- **`/services` and `/services/[slug]`** — **built.** A page per published
  service, managed at `/admin/services` (`docs/decisions.md` §2.21), with
  `app/services/services.ts` as the no-database fallback. The landing page's
  card grid reads the same published list, so the two cannot drift. Property Investment stays informational: no call
  to action, the licensing notice above the fold, and its closing band offers
  only registration.
- **Passport™ — `/passport`** — **built.** The nav item's explainer: what a
  Passport is, the eight mandatory entries, the four milestone states with
  "delayed" treated as a fact rather than an alarm, what evidence attaches, and
  how to read the provenance. The record itself is §3.1.
- **Media — `/media`, with `/news` beneath it** — **built**; see §3.4.
- **Contact — `/contact`** — **built**; see §3.6.
- **`/governance`** — in the footer with no page behind it. Given the brand
  position, this one matters more than it looks.
- **Resources — `/resources`** — **built** (`/downloads` redirects to it). The
  download centre grouped by category (company profile, capability statement,
  brochures, project profiles, other), each file a row with a mono type tile,
  title, description, "PDF · 2.4 MB" and a Download button; then the way to
  `/faqs`; then the policies — the four legal pages as cards, plus any policy
  published as a document. Documents are managed at `/admin/downloads`; every
  download goes through a counted endpoint. A project's own documents are
  listed under the hero actions on its page, as compact links with type and
  size, hidden when there are none. See `docs/decisions.md` §2.25. The
  footer's "Downloads" entry and the media centre link to it.
- **`/faqs`** — **built.** Grouped by category, each entry a native disclosure with a stable `#id` anchor that search results link to. Read from the new `GET /api/faqs`.
- **Careers — `/careers`, `/careers/[slug]`** — **built.** `/careers` opens
  with Home / Careers and two actions (current vacancies, a speculative
  application), then the open vacancies grouped full-time, part-time and
  contract as hairline cards (discipline, title, "Full-time · Lekki, Lagos ·
  Hybrid", salary when published, summary, "Closes 6 December 2026" or "Open
  until filled", View and apply); then graduate opportunities and the
  internship programme side by side on grey, each with its vacancies or a
  plain "none open" note; then how we work beside the disciplines; then the
  speculative application form on the `line` ground, with equal opportunity
  and what happens to an application beside it. A vacancy page is the hero
  (type eyebrow, title, summary, location and closing date on the mono rule),
  the advert with a facts column, and its form. A closed vacancy keeps its
  page with an orange-ruled "This vacancy has closed" note and no form.
  **The form** follows the contact form and adds an error summary that takes
  focus and links to each field, errors under each field, a CV field (PDF or
  .docx, up to 4 MB, with the chosen file's name and size), upload progress,
  and a success state that replaces it. Vacancies are managed at
  `/admin/careers`; see `docs/decisions.md` §2.28. There is no company-wide
  benefits list — each vacancy lists its own — until CoBuilt supplies one.
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
  delete), Passport™ milestones per project, news (list, create, edit, delete;
  the five media-centre categories),
  leadership profiles (publish, order, homepage spotlight), homepage settings
  (hero copy, featured video, figures, optional sections), the video library
  (add by YouTube link, category, project, thumbnail, order, publish,
  feature), contact details (address, phones, emails, WhatsApp, hours, map
  position), downloads (PDF upload or link, category, project, order,
  publish, download counts), 3D tours (upload, edit, delete), the image
  gallery (albums: create, order, publish, delete; photographs: upload with
  progress or add by link, alt text — required — caption and date, order,
  cover, delete),
  careers vacancies (type, discipline, location, lists, salary, closing date,
  order, publish, application counts), the job applications inbox (admins by
  default: masked list filtered by vacancy, status and spam; open, status,
  staff notes, CV download through the console, delete),
  redirects from old addresses (admin only: old address, new address,
  permanent or temporary, hit counts; see below),
  investor-content approval, users and roles,
  and the audit log. Editors send only the fields that changed, and any change
  to an investor figure withdraws its approval after a confirmation. A record
  mirrored from the CMS carries a notice that the CMS will overwrite console
  edits. An album is attached to a project from the album's own form in
  `/admin/gallery`, not from the project editor.

### Small gaps worth folding in

- **404 and 500 pages** — visitors currently get the unstyled Next.js default.
  More routes now call `notFound()` — an unknown service slug, an unknown
  article — so this is more visible than it was.
- **Search engine basics** — **built** (`docs/decisions.md` §2.27).
  `/sitemap.xml` lists every published page with its last change;
  `/robots.txt` keeps crawlers off the console, the API and search results,
  and off every preview deployment entirely; every public page has an
  absolute canonical, with list filters dropped; and pages carry Schema.org
  structured data (organisation and site search on the homepage,
  breadcrumbs, articles, films, FAQs, leaders, services, albums). None of it
  is visible. **Redirects** are the one screen: `/admin/redirects` is a form
  above a table of rules (old address, new address, 308 or 307, hits, last
  hit, edit, delete). Both addresses are checked as they are typed, and a
  rule that would chain or loop is refused with the rule it collides with
  named. A rule applies only where no page answers, so it never takes a live
  page down.
- **Social preview images** — **built.** A branded card per page, and an item's own photography wins where it has some. See docs/decisions.md §2.18.
- **A video library page** — **built.** `/videos` leads with the featured film
  in the homepage's click-to-load player, then a grid of cards (still, play
  badge, category, date, length, project link) with category pills, a project
  picker and search; `/videos/[slug]` is the player, the description, the
  facts (category, project, recorded, length) and up to three related films.
  Cards show the editor's thumbnail or the project's photograph, never
  YouTube's, so nothing reaches YouTube before play. Project pages list their
  films in a "Videos" block. Managed at `/admin/videos`; see
  `docs/decisions.md` §2.23.

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
  The trail is also published as a Schema.org `BreadcrumbList`, so a new page
  that uses `PageHero` gets that for free. Every crumb but the last needs a link.

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

- Live reference: the landing page, `app/home-page.tsx` (loaders beside it in `app/home-*.ts`).
- Design tokens and base styles: `styles/globals.css`.
- Shared class strings: `components/ui.ts`, `components/prose.ts`.
- Navigation and footer content: `components/site.ts`.
- API contract, with every field and response shape: `docs/openapi.yaml`.
- Canonicals, the site origin and indexing: `src/lib/seo.ts`; structured data:
  `src/lib/structuredData.ts`; sitemap and robots: `app/sitemap.ts`, `app/robots.ts`.
- Decisions, deviations and deferrals: `docs/decisions.md`.
- Contrast rules as an executable test: `__tests__/unit/contrast.test.ts`.
