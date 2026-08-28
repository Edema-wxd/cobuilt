-- 0005_passport_milestones.sql
-- Project Passport(TM): the auditable construction timeline.

CREATE TABLE passport_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  milestone_type milestone_type NOT NULL,

  title VARCHAR(255),
  description TEXT,
  scheduled_date DATE,
  actual_date DATE,
  status milestone_status NOT NULL DEFAULT 'pending',

  -- Ordering within a project's timeline. Distinct from milestone_type so a
  -- project can carry several 'custom' milestones in a defined order.
  sort_order INT NOT NULL DEFAULT 0,

  -- Media & evidence
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  document_urls TEXT[] NOT NULL DEFAULT '{}',
  video_url VARCHAR(512),

  -- Visibility: internal milestones are withheld from the public endpoint.
  is_public BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timeline
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Public metadata (for SEO)
  meta_title VARCHAR(255),
  meta_description VARCHAR(160),

  -- A completed milestone must carry the date it completed on, otherwise the
  -- public timeline shows a completion with no evidence of when.
  CONSTRAINT passport_completed_has_date
    CHECK (status <> 'completed' OR actual_date IS NOT NULL)
);

CREATE INDEX idx_passport_project ON passport_milestones (project_id);
CREATE INDEX idx_passport_triggered ON passport_milestones (triggered_at DESC);
CREATE INDEX idx_passport_project_order ON passport_milestones (project_id, sort_order, triggered_at);

CREATE TRIGGER trg_passport_updated_at
  BEFORE UPDATE ON passport_milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
