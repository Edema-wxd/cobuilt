import {
  NEWS_CATEGORIES,
  newsCategoryAliases,
  newsCategoryLabel,
  normalizeNewsCategory,
} from '@/lib/news-categories';
import { createNewsBody, listNewsQuery, newsCategory, updateNewsBody } from '@/lib/schemas/news';

/**
 * The media centre's categories (docs/decisions.md §2.22). The launch-era
 * values must keep working wherever they arrive: a stored row, a shared
 * `/news?category=update` link, an API client, the CMS.
 */

describe('normalizeNewsCategory', () => {
  it.each([
    ['update', 'project_update'],
    ['announcement', 'company_announcement'],
    ['press_release', 'press_release'],
    ['Press release', 'press_release'],
    ['press-release', 'press_release'],
    ['  Project Update ', 'project_update'],
    ['UPDATE', 'project_update'],
    ['thought_leadership', 'thought_leadership'],
    ['Industry insight', 'industry_insight'],
  ])('reads %p as %p', (input, expected) => {
    expect(normalizeNewsCategory(input)).toBe(expected);
  });

  it('keeps a category of the CMS’s own as sent, trimmed', () => {
    expect(normalizeNewsCategory(' Events ')).toBe('Events');
  });

  it('treats blank as no category', () => {
    expect(normalizeNewsCategory('')).toBeNull();
    expect(normalizeNewsCategory('   ')).toBeNull();
    expect(normalizeNewsCategory(null)).toBeNull();
    expect(normalizeNewsCategory(undefined)).toBeNull();
  });
});

describe('newsCategoryAliases', () => {
  it('matches a renamed category under its launch-era name too', () => {
    expect(newsCategoryAliases('project_update')).toEqual(['project_update', 'update']);
    expect(newsCategoryAliases('update')).toEqual(['project_update', 'update']);
    expect(newsCategoryAliases('company_announcement')).toEqual([
      'company_announcement',
      'announcement',
    ]);
  });

  it('matches only itself otherwise', () => {
    expect(newsCategoryAliases('press_release')).toEqual(['press_release']);
    expect(newsCategoryAliases('Events')).toEqual(['Events']);
  });
});

describe('newsCategoryLabel', () => {
  it('names each of the five in English', () => {
    expect(NEWS_CATEGORIES.map(newsCategoryLabel)).toEqual([
      'Press release',
      'Project update',
      'Thought leadership',
      'Industry insight',
      'Company announcement',
    ]);
  });

  it('names a launch-era value as the category it became', () => {
    expect(newsCategoryLabel('update')).toBe('Project update');
    expect(newsCategoryLabel('announcement')).toBe('Company announcement');
  });

  it('humanises a category of the CMS’s own', () => {
    expect(newsCategoryLabel('site_visit')).toBe('Site visit');
  });
});

describe('news schemas', () => {
  it('lists the spec’s five categories', () => {
    expect(newsCategory.options).toEqual([
      'press_release',
      'project_update',
      'thought_leadership',
      'industry_insight',
      'company_announcement',
    ]);
  });

  it('reads a shared /news?category=update link as project updates', () => {
    expect(listNewsQuery.parse({ category: 'update' }).category).toBe('project_update');
    expect(listNewsQuery.parse({ category: 'announcement' }).category).toBe(
      'company_announcement',
    );
  });

  it('leaves a blank or absent category filter unset', () => {
    expect(listNewsQuery.parse({}).category).toBeUndefined();
    expect(listNewsQuery.parse({ category: '' }).category).toBeUndefined();
  });

  it('stores a launch-era category from an API client under its new name', () => {
    const body = createNewsBody.parse({ title: 'Roof on', content: 'Body', category: 'update' });
    expect(body.category).toBe('project_update');
    expect(updateNewsBody.parse({ category: 'announcement' }).category).toBe(
      'company_announcement',
    );
  });

  it('clears the category when sent blank or null', () => {
    expect(updateNewsBody.parse({ category: '' }).category).toBeNull();
    expect(updateNewsBody.parse({ category: null }).category).toBeNull();
  });

  it('keeps a CMS category round-tripped through the console', () => {
    expect(updateNewsBody.parse({ category: 'Events' }).category).toBe('Events');
  });
});
