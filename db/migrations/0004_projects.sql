-- 0004_projects.sql
-- Projects, the central content entity.

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  long_description TEXT,

  -- Taxonomy
  project_type_id UUID REFERENCES project_types(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
  status project_status NOT NULL DEFAULT 'future',

  -- Media & content
  featured_image_url VARCHAR(512),
  gallery_ids UUID[] NOT NULL DEFAULT '{}',
  service_ids UUID[] NOT NULL DEFAULT '{}',
  tag_ids UUID[] NOT NULL DEFAULT '{}',

  -- Project Passport(TM) metadata
  passport_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  passport_start_date DATE,
  passport_completion_target DATE,

  -- Investor info. investor_highlights is only served publicly once legal has
  -- approved it (§10); the approval flag lives beside the payload so the two
  -- can never drift apart.
  investment_amount NUMERIC(15,2),
  expected_roi NUMERIC(5,2),
  investor_highlights JSONB,
  investor_highlights_approved BOOLEAN NOT NULL DEFAULT FALSE,
  investor_highlights_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  investor_highlights_approved_at TIMESTAMPTZ,

  -- SEO & metadata
  meta_title VARCHAR(255),
  meta_description VARCHAR(160),
  open_graph_image_url VARCHAR(512),
  canonical_url VARCHAR(512),

  -- CMS provenance. When content is authored in the headless CMS, the CMS is
  -- the system of record and this row is its projection (see docs/cms-sync.md).
  cms_source VARCHAR(50),
  cms_id VARCHAR(255),
  cms_synced_at TIMESTAMPTZ,

  -- Lifecycle. published_at NULL = draft; deleted_at NOT NULL = soft-deleted,
  -- which the spec prefers over a hard DELETE (§3).
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Full-text search vector. The regconfig must be a literal for the
  -- expression to be immutable, which a generated column requires.
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(long_description, '')
    )
  ) STORED,

  CONSTRAINT projects_cms_identity_unique UNIQUE (cms_source, cms_id)
);

CREATE INDEX idx_projects_slug ON projects (slug);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_published ON projects (published_at DESC NULLS LAST);
CREATE INDEX idx_projects_search ON projects USING GIN (search_vector);
CREATE INDEX idx_projects_title_trgm ON projects USING GIN (title gin_trgm_ops);
CREATE INDEX idx_projects_type ON projects (project_type_id);
CREATE INDEX idx_projects_location ON projects (location_id);
CREATE INDEX idx_projects_sector ON projects (sector_id);
-- The public list endpoint always filters on "live" rows; this index serves it.
CREATE INDEX idx_projects_live ON projects (published_at DESC)
  WHERE deleted_at IS NULL AND published_at IS NOT NULL;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Photo albums attached to a project (CMS-managed content mirrored locally).
CREATE TABLE gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  cover_image_url VARCHAR(512),
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_albums_project ON gallery_albums (project_id);

CREATE TRIGGER trg_gallery_albums_updated_at
  BEFORE UPDATE ON gallery_albums
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
