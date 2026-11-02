-- 0018_media_categories.sql
-- The media centre's article categories, as the client's spec names them.
--
-- The site launched with three categories: press_release, update and
-- announcement. The spec asks for five — press release, project update,
-- thought leadership, industry insight and company announcement — and two of
-- the launch three are the same things under shorter names. Rather than keep
-- two spellings of one category in the table, the stored rows take the new
-- names here, and every write path (API, console, CMS sync) normalises the old
-- names from now on (src/lib/news-categories.ts).
--
-- One spelling matters because several readers compare the column exactly and
-- would otherwise split a category in two: the category facet, the related-
-- articles ranking and the search filters. The column stays free text, with no
-- CHECK: the CMS may send a category of its own, and that is kept as sent.
--
-- Only the category changes, so `updated_at` must not: an article page shows
-- "Updated" when that moves, and nobody edited these articles. The trigger
-- that stamps it is held off for the two statements (the migration runs in a
-- transaction, so it cannot be left off).
--
-- If Meilisearch is configured, run `npm run search:reindex` after deploying,
-- so its copy of each article carries the new category too.

ALTER TABLE news_articles DISABLE TRIGGER trg_news_updated_at;

UPDATE news_articles SET category = 'project_update' WHERE lower(trim(category)) = 'update';
UPDATE news_articles SET category = 'company_announcement' WHERE lower(trim(category)) = 'announcement';

ALTER TABLE news_articles ENABLE TRIGGER trg_news_updated_at;

COMMENT ON COLUMN news_articles.category IS
  'press_release | project_update | thought_leadership | industry_insight | company_announcement, or a CMS category kept as sent';
