-- 0023_redirects.sql
-- Redirects managed from the console at /admin/redirects: an old address on
-- this site, and where a visitor who asks for it is sent instead.
--
-- A rule applies only where no page answers (docs/decisions.md §2.27): the
-- 404 path looks it up, so a rule can never take a live page off the site.
-- Sources are stored as they are compared — lower case, decoded, without a
-- trailing slash, query string or fragment (src/lib/redirectPaths.ts).

CREATE TABLE redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_path VARCHAR(512) NOT NULL UNIQUE,
  -- A path on this site (with any query string or fragment) or an absolute
  -- http(s) URL, as the editor gave it.
  destination VARCHAR(1024) NOT NULL,
  -- Where the destination lands on this site, in source form; null for
  -- another site. What the loop check compares: no rule's source may be
  -- another rule's destination, so every redirect is a single hop.
  destination_path VARCHAR(1024),
  -- 308 when true, 307 when false.
  permanent BOOLEAN NOT NULL DEFAULT TRUE,

  hit_count BIGINT NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The API refuses all of these with a message naming the field; the
  -- constraints hold the line for anything written around it.
  CONSTRAINT redirects_source_relative CHECK (source_path LIKE '/%' AND source_path NOT LIKE '//%'),
  CONSTRAINT redirects_source_not_home CHECK (source_path <> '/'),
  CONSTRAINT redirects_source_not_reserved CHECK (source_path !~ '^/(admin|api|_next)(/|$)'),
  CONSTRAINT redirects_destination_valid CHECK (
    (destination LIKE '/%' AND destination NOT LIKE '//%') OR destination ~* '^https?://'
  ),
  CONSTRAINT redirects_not_to_itself CHECK (destination_path IS DISTINCT FROM source_path),
  CONSTRAINT redirects_hit_count_positive CHECK (hit_count >= 0)
);

-- The loop check looks a path up among the destinations.
CREATE INDEX idx_redirects_destination_path ON redirects (destination_path)
  WHERE destination_path IS NOT NULL;

-- updated_at means "last edited". A hit changes only the count and its time,
-- so the trigger is skipped for it, as for document downloads (0021).
CREATE TRIGGER trg_redirects_updated_at
  BEFORE UPDATE ON redirects
  FOR EACH ROW
  WHEN (OLD.hit_count IS NOT DISTINCT FROM NEW.hit_count)
  EXECUTE FUNCTION set_updated_at();
