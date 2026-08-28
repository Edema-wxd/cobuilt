-- 0006_virtual_tours.sql
-- 3D virtual tours attached to projects.

CREATE TABLE virtual_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  tour_name VARCHAR(255) NOT NULL,
  tour_type tour_type NOT NULL,

  -- Storage
  model_file_s3_key VARCHAR(512),  -- .glb / .obj key, or vendor asset ID
  file_size_bytes BIGINT,
  thumbnail_url VARCHAR(512),
  tour_url VARCHAR(512),
  embed_code TEXT,  -- For Matterport or another third-party viewer

  -- Metadata
  description TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INT NOT NULL DEFAULT 0,

  -- Lifecycle
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_status tour_processing_status NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Each tour type carries its payload in a different column; enforce that the
  -- one it needs is actually present rather than discovering it in the viewer.
  CONSTRAINT virtual_tours_payload_present CHECK (
    (tour_type = 'threejs_model'    AND model_file_s3_key IS NOT NULL) OR
    (tour_type = 'matterport_embed' AND (embed_code IS NOT NULL OR tour_url IS NOT NULL)) OR
    (tour_type = 'custom_viewer'    AND tour_url IS NOT NULL)
  )
);

CREATE INDEX idx_tours_project ON virtual_tours (project_id);
CREATE INDEX idx_tours_featured ON virtual_tours (featured, published);

CREATE TRIGGER trg_tours_updated_at
  BEFORE UPDATE ON virtual_tours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
