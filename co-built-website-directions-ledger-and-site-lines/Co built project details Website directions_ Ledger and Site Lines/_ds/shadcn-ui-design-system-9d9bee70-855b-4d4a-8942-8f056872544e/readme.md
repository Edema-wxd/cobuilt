# shadcn/ui Design System

A design system built from the **shadcn/ui** open-source component library (the "new-york" style variant, Tailwind v4 tokens) — the base, unbranded design language shadcn/ui ships as its default theme. This is not a specific company; it's a neutral, minimal foundation intended as a starting point for products that build on shadcn conventions.

**Source repository:** [shadcn-ui/ui](https://github.com/shadcn-ui/ui) — read `apps/v4/app/globals.css` for the token source of truth and `apps/v4/registry/new-york-v4/ui/` for component source. Explore this repo directly for the full ~60-component inventory (Command, Carousel, Chart, Calendar, Menubar, Sidebar, Form, Combobox, and more) beyond the core set recreated here.

## Content fundamentals

shadcn/ui is developer-facing documentation, not consumer marketing copy — tone is terse, technical, second-person ("you"), instructional.
- Copy is short, declarative, lowercase-friendly in code contexts (`npx shadcn add button`), sentence case elsewhere.
- No emoji, no exclamation points, no marketing superlatives ("blazing fast", "revolutionary"). Confidence comes from plainness.
- Component descriptions read as one factual sentence: "A modal dialog that interrupts the user with important content."
- Error/empty states are direct and short: "No results found.", "Payment failed."

## Visual foundations

- **Color**: near-monochrome. Light mode primary/foreground is pure black on white; dark mode inverts to near-white on near-black (`oklch(0.145 0 0)`). Semantic color (destructive red) is the only saturated hue in the base theme — everything else is achromatic (`oklch(_ 0 0)`). A 5-step blue chart scale exists for data visualization only.
- **Type**: Geist (sans, used for both body and headings — no separate display face) and Geist Mono for code/numeric data. No serif anywhere.
- **Spacing**: 4px base unit (`--spacing: 0.25rem`), Tailwind's default scale.
- **Radius**: one base token (`--radius: 0.625rem` ≈ 10px) with `sm/md/lg/xl` derived by ±4px steps. Buttons and inputs use `md`; cards and dialogs use `lg`/`xl`.
- **Backgrounds**: flat solid fills only. No gradients, no photography, no illustration, no texture/grain — the system is intentionally content-neutral.
- **Shadows**: very subtle, layered `xs → xl` tokens (e.g. card = `shadow-sm`, dropdown/dialog = `shadow-md`/`lg`). Never used decoratively — only to lift overlays and cards a hair off the page.
- **Borders**: 1px hairline borders (`--border`) are the primary structural device — used far more than shadow for separating cards, inputs, and table rows.
- **Animation**: fast and functional only — 150ms fades/zooms on open/close of dialogs, dropdowns, tooltips, tabs. No bounce, no spring, no decorative motion.
- **Hover/press**: hover mostly shifts background to `accent`/darkens by ~10% opacity mix; links underline on hover. Active/press state dims opacity to ~60% on buttons/links (see `a:active,button:active{opacity:.6}` in source).
- **Focus**: a consistent 3px `ring` halo at 50% opacity plus a solid ring-colored border — applied uniformly across every interactive control.
- **Cards**: 1px border, `lg`/`xl` radius, `shadow-sm`, no colored left-border accents, no top image by default.
- **Transparency/blur**: used sparingly — dialog overlay is `black/50%`; dark-mode borders use `white/10%` alpha rather than a separate dark border color.

## Iconography

The source repo uses **Lucide** (`lucide-react`) as its icon set throughout — stroke-based, 1.5–2px stroke weight, 16–24px default size, no fill. No icon font, no PNG icons, no emoji. This system does not vendor Lucide's SVGs; consuming projects should link Lucide from CDN (`https://unpkg.com/lucide-react` or the static SVG CDN) or install it, matching the stroke weight used in `Checkbox`, `Select`, `Dialog`, `RadioGroup`, `DropdownMenu` above (chevrons, check, X, circle).

## Logo

No logo/brand mark exists in the source — shadcn/ui's identity is typographic only (the wordmark "shadcn"). `thumbnail.html` renders the name in place of a mark rather than inventing one.

## Fonts

Geist and Geist Mono are loaded via the Google Fonts CDN (`tokens/fonts.css`) rather than self-hosted binaries, since the source repo fetches them at build time via `next/font/google` and ships no static font files to copy. If you need self-hosted `.woff2` files, download them from [Vercel's Geist repo](https://github.com/vercel/geist-font) or Google Fonts and replace the `@import` with `@font-face` rules.

## Components

Core set recreated as framework-agnostic React (plain CSS classes + custom properties, no Radix/Tailwind runtime dependency), organized under `components/core/`:

**Forms:** Button, Input, Textarea, Label, Checkbox, Switch, RadioGroup, Select
**Feedback:** Alert, Badge, Progress, Skeleton
**Data display:** Card, Avatar, Separator, Kbd
**Navigation:** Tabs
**Overlay:** Dialog, Tooltip, DropdownMenu

Each directory has `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`, and a `*.card.html` demo. This is a curated core subset of shadcn/ui's ~60-component registry (full list in the source repo) chosen to cover every component family a typical product screen needs — forms, feedback, navigation, overlays, and data display.

**Intentional additions:** none — every component here has a direct source counterpart in `apps/v4/registry/new-york-v4/ui/`.

## Index

- `styles.css` — root stylesheet, imports all tokens + component CSS
- `tokens/` — colors (incl. `.dark`), typography, spacing/radius, shadows, fonts
- `components/ui.css` — shared component CSS classes (all `.sc-*` classes)
- `components/core/<Name>/` — one React component per family
- `guidelines/` — foundation specimen cards (colors, type, spacing, radius, shadow)
- `ui_kits/dashboard/` — a generic app-shell screen (sidebar, cards, table, tabs, dialog) demonstrating the components together
- `SKILL.md` — Claude Code-compatible skill wrapper for this system

## Caveats / ask

- Overlay components (Dialog, Tooltip, DropdownMenu, Select) are simplified plain-React recreations, not Radix Primitives — no portal, focus trap, or keyboard nav beyond the basics. Fine for prototyping visuals; swap in Radix for production accessibility.
- Font is CDN-linked, not self-hosted — flag if you need offline/self-hosted `.woff2` files.
- Only ~20 of shadcn/ui's ~60 registry components are recreated. Tell me which of the rest (Command palette, Calendar, Chart, Carousel, Sidebar, Menubar, Combobox, Form, Data Table, Toast/Sonner...) matter most for your product and I'll add them next.
- No real product screens exist to recreate (this source is a component library, not an app) — the one "UI kit" screen is a generic dashboard assembled from the components, not a copy of an existing product. Point me at your actual product (repo or Figma) and I'll build kit screens from that instead.
