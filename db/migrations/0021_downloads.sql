-- 0021_downloads.sql
-- The download centre at /resources: company profile, capability statement,
-- brochures, project profiles, policies and anything else CoBuilt publishes
-- as a file. Managed from the console at /admin/downloads.
--
-- A document is either a PDF uploaded to UploadThing (file_key is set, and
-- deleting the row deletes the file) or a link to a file hosted elsewhere
-- (file_key is null). Either way file_url is what a visitor is sent to.
--
-- Downloads are counted, because download activity is a business metric, but
-- nothing about the person downloading is stored: a total on the row and a
-- count per day, and no IP address, identifier or user agent anywhere.

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(30) NOT NULL,

  -- Where the download endpoint redirects. https only: it is linked from an
  -- https page, and a javascript: or data: URL must never become an href.
  file_url VARCHAR(512) NOT NULL,
  -- The UploadThing key, when the file was uploaded through the console.
  file_key VARCHAR(512),
  -- Lowercase extension ('pdf', 'docx'); null when a link does not say.
  file_type VARCHAR(10),
  -- Known for uploads; null for a link, whose size the site cannot vouch for.
  file_size_bytes BIGINT,

  -- A project profile (or any document) can belong to one project, and is
  -- then listed on that project's page too.
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  download_count BIGINT NOT NULL DEFAULT 0,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT documents_category_valid CHECK (category IN (
    'company_profile', 'capability_statement', 'brochure', 'project_profile', 'policy', 'other'
  )),
  CONSTRAINT documents_file_url_https CHECK (file_url LIKE 'https://%'),
  CONSTRAINT documents_file_size_positive CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  CONSTRAINT documents_download_count_positive CHECK (download_count >= 0)
);

-- The public list reads published rows in editorial order, by category or by
-- project.
CREATE INDEX idx_documents_published ON documents (category, sort_order, title) WHERE published;
CREATE INDEX idx_documents_project ON documents (project_id) WHERE project_id IS NOT NULL;

-- updated_at means "last edited". A download changes only download_count, so
-- the trigger is skipped for it; otherwise the console would show every
-- document as edited whenever someone downloaded it.
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (OLD.download_count IS NOT DISTINCT FROM NEW.download_count)
  EXECUTE FUNCTION set_updated_at();

-- Downloads per document per day (West Africa Time), so the console can show
-- recent activity and not only an all-time total. A count, nothing else.
CREATE TABLE document_download_days (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  downloads INT NOT NULL DEFAULT 0,
  PRIMARY KEY (document_id, day)
);
