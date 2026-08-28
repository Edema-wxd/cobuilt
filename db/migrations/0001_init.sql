-- 0001_init.sql
-- Extensions, shared enum types and the updated_at trigger helper.
--
-- Note on the spec (§2): the schema in the technical specification declares
-- `INDEX ...` clauses and inline `ENUM(...)` types inside CREATE TABLE. Neither
-- is valid PostgreSQL — indexes are separate CREATE INDEX statements and enums
-- are named types created with CREATE TYPE. The intent is preserved verbatim;
-- only the syntax is corrected.

-- gen_random_uuid() is built into PostgreSQL 13+, no extension required.
-- pg_trgm backs autocomplete and fuzzy slug lookups when Meilisearch is
-- unavailable (see src/lib/search/postgres.ts).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- pgcrypto supplies gen_random_bytes(), used for unsubscribe tokens (0008).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE project_status AS ENUM ('future', 'ongoing', 'completed');

CREATE TYPE milestone_type AS ENUM (
  'commencement',
  'foundation',
  'superstructure',
  'roofing',
  'mep',
  'finishes',
  'practical_completion',
  'handover',
  'custom'
);

CREATE TYPE milestone_status AS ENUM ('pending', 'in_progress', 'completed', 'delayed');

CREATE TYPE tour_type AS ENUM ('threejs_model', 'matterport_embed', 'custom_viewer');

CREATE TYPE tour_processing_status AS ENUM ('pending', 'processing', 'ready', 'failed');

CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer', 'investor');

CREATE TYPE investor_status AS ENUM ('prospect', 'active', 'inactive');

-- Keeps updated_at honest without relying on every caller to set it.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
