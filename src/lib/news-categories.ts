/**
 * The media centre's article categories.
 *
 * The client's spec names five kinds of article: press releases, project
 * updates, thought leadership, industry insights and company announcements.
 * The site launched with three, stored as `press_release`, `update` and
 * `announcement`; the last two are the same things under shorter names, so
 * they are read as `project_update` and `company_announcement` wherever a
 * category arrives — an API body, a query string, a CMS entry, a stored row —
 * rather than refused. Migration 0018 rewrote the stored rows once. See
 * docs/decisions.md §2.22.
 *
 * `news_articles.category` itself stays free text: the CMS can send a
 * category of its own, and the console keeps such a value selectable rather
 * than discarding it. Only the five below are offered for new articles.
 *
 * No imports, so the public pages, the admin console and the API all read the
 * same list without pulling the database or zod into a browser bundle.
 */

/** In the order the media centre shows them. */
export const NEWS_CATEGORIES = [
  'press_release',
  'project_update',
  'thought_leadership',
  'industry_insight',
  'company_announcement',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  press_release: 'Press release',
  project_update: 'Project update',
  thought_leadership: 'Thought leadership',
  industry_insight: 'Industry insight',
  company_announcement: 'Company announcement',
};

/** The launch-era values, and what each one is now called. */
export const LEGACY_NEWS_CATEGORIES: Readonly<Record<string, NewsCategory>> = {
  update: 'project_update',
  announcement: 'company_announcement',
};

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === 'string' && (NEWS_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The stored form of a category. A known category in any spelling — "Press
 * release", `press-release`, `update` — becomes its canonical value; anything
 * else is kept as given, trimmed. Blank means no category.
 */
export function normalizeNewsCategory(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const key = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (isNewsCategory(key)) return key;
  return LEGACY_NEWS_CATEGORIES[key] ?? trimmed;
}

/**
 * Every stored value that means `category`, for filtering: the canonical value
 * and its launch-era name. Rows are rewritten by migration 0018, so this only
 * matters for a row written around the API since.
 */
export function newsCategoryAliases(category: string): string[] {
  const canonical = normalizeNewsCategory(category);
  if (!canonical) return [];
  const legacy = Object.keys(LEGACY_NEWS_CATEGORIES).filter(
    (name) => LEGACY_NEWS_CATEGORIES[name] === canonical,
  );
  return [canonical, ...legacy];
}

/** The category in English: `project_update` reads as "Project update". */
export function newsCategoryLabel(value: string): string {
  const canonical = normalizeNewsCategory(value) ?? value;
  if (isNewsCategory(canonical)) return NEWS_CATEGORY_LABELS[canonical];
  return canonical.replace(/[_-]+/g, ' ').replace(/^./, (character) => character.toUpperCase());
}
