-- 0019_videos.sql
-- The video library: films on the official CoBuilt YouTube channel, listed at
-- /videos and managed from the admin console.
--
-- A row is a pointer to a YouTube video, not a copy of it. Only the 11-character
-- video ID is stored; the embed and watch links are built from it
-- (src/lib/youtube.ts), so nothing an editor pastes ever becomes an iframe
-- `src` directly.
--
-- 0012 gave projects a list of timeline video links for the Passport page.
-- That stays as it is: those are evidence attached to the record. A library
-- video is editorial content with its own page, category and order, and may
-- point at a project rather than belong to one.

CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One row per video: the same film twice in the library is an editor's slip.
  youtube_id VARCHAR(11) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  -- The client's categories; labels live in src/lib/videos.ts.
  category VARCHAR(40) NOT NULL,
  -- The development the film documents, if any. Deleting the project keeps
  -- the film in the library, unlinked.
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  -- An https still to show instead of the project's photograph. YouTube's own
  -- thumbnail is never used on the index (docs/decisions.md §2.23).
  thumbnail_url VARCHAR(512),
  duration_seconds INT,
  -- When the footage was shot or the film released; "latest" sorts by it.
  recorded_on DATE,
  -- The first featured video, in display order, leads the library page.
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT videos_youtube_id_format CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  CONSTRAINT videos_category_valid CHECK (category IN (
    'project_documentary',
    'construction_update',
    'drone',
    'leadership_interview',
    'educational',
    'corporate',
    'event_highlights'
  )),
  CONSTRAINT videos_thumbnail_https CHECK (thumbnail_url IS NULL OR thumbnail_url LIKE 'https://%'),
  CONSTRAINT videos_duration_positive CHECK (duration_seconds IS NULL OR duration_seconds > 0)
);

-- The public pages read published videos in editorial order, by category and
-- by project.
CREATE INDEX idx_videos_live ON videos (sort_order, created_at) WHERE published;
CREATE INDEX idx_videos_category ON videos (category) WHERE published;
CREATE INDEX idx_videos_project ON videos (project_id) WHERE project_id IS NOT NULL;

CREATE TRIGGER trg_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
