-- 0020_gallery.sql
-- The image gallery: albums organised by the client's six categories, each
-- holding images with their own alt text, caption and order, managed and
-- uploaded from the admin console and shown at /gallery.
--
-- 0004 created `gallery_albums` as a CMS mirror attached to a project, with
-- its images as a bare array of URLs. A URL cannot carry the descriptive alt
-- text the spec requires, a caption or an order of its own, so the images
-- move to a table of their own here and the array is dropped. The table is
-- extended rather than replaced: projects already point at albums through
-- `gallery_albums.project_id` and `projects.gallery_ids`, and both keep
-- working (docs/decisions.md §2.10, §2.24).

ALTER TABLE gallery_albums
  -- Completed projects, Ongoing projects, Future concepts, Events, Team
  -- activities, Corporate branding: the spec's six. Backfilled below.
  ADD COLUMN category VARCHAR(30),
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0,
  -- The image shown on the album's card. Null falls back to `cover_image_url`
  -- (an external cover the CMS set), then to the album's first image.
  ADD COLUMN cover_image_id UUID,
  ADD CONSTRAINT gallery_albums_category_valid CHECK (
    category IN (
      'completed_projects', 'ongoing_projects', 'future_concepts',
      'events', 'team_activities', 'corporate_branding'
    )
  );

-- An album is a draft until someone publishes it. Rows already here keep the
-- state they have.
ALTER TABLE gallery_albums ALTER COLUMN published SET DEFAULT FALSE;

-- An album outlives the project it documents: a hard-deleted project (rare;
-- projects are soft-deleted) unlinks its albums rather than taking the
-- photography, and the uploaded files behind it, with it.
ALTER TABLE gallery_albums DROP CONSTRAINT gallery_albums_project_id_fkey;
ALTER TABLE gallery_albums
  ADD CONSTRAINT gallery_albums_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Existing albums take the category their project's stage implies. One with
-- no project is filed under Events; an editor can move it.
UPDATE gallery_albums a
   SET category = CASE p.status
                    WHEN 'completed' THEN 'completed_projects'
                    WHEN 'ongoing' THEN 'ongoing_projects'
                    ELSE 'future_concepts'
                  END
  FROM projects p
 WHERE p.id = a.project_id;
UPDATE gallery_albums SET category = 'events' WHERE category IS NULL;
ALTER TABLE gallery_albums ALTER COLUMN category SET NOT NULL;

CREATE TABLE gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  -- Public URL: the UploadThing file's, an https link, or a path on this site.
  image_url VARCHAR(1024) NOT NULL,
  -- Set when the file was uploaded through the console, so deleting the image
  -- can delete the stored file too. Null for a linked image.
  file_key VARCHAR(512),
  -- Required: every image on the site is described for screen readers.
  alt_text VARCHAR(300) NOT NULL,
  caption VARCHAR(500),
  -- Intrinsic size in pixels, when the console could read it.
  width INT,
  height INT,
  taken_on DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT gallery_images_alt_text_present CHECK (length(btrim(alt_text)) > 0),
  CONSTRAINT gallery_images_size_positive CHECK (
    (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)
  )
);

CREATE INDEX idx_gallery_images_album ON gallery_images (album_id, sort_order, created_at);
CREATE UNIQUE INDEX idx_gallery_images_file_key ON gallery_images (file_key) WHERE file_key IS NOT NULL;

CREATE TRIGGER trg_gallery_images_updated_at
  BEFORE UPDATE ON gallery_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A cover that is deleted falls back rather than dangling. That it belongs to
-- the same album is checked where it is set (src/lib/repositories/gallery.ts).
ALTER TABLE gallery_albums
  ADD CONSTRAINT gallery_albums_cover_image_fkey
  FOREIGN KEY (cover_image_id) REFERENCES gallery_images(id) ON DELETE SET NULL;

-- The URLs already held move across in their order. They had no alt text, so
-- each is described by its album and position — the same indexed description
-- the project page already gave them — until an editor writes a real one.
INSERT INTO gallery_images (album_id, image_url, alt_text, sort_order)
SELECT a.id,
       u.url,
       left(a.title, 260) || ', photograph ' || u.position,
       u.position * 10
  FROM gallery_albums a,
       unnest(a.image_urls) WITH ORDINALITY AS u(url, position)
 WHERE btrim(u.url) <> '';

ALTER TABLE gallery_albums DROP COLUMN image_urls;

-- The public gallery reads published albums in editorial order.
CREATE INDEX idx_gallery_albums_live ON gallery_albums (sort_order, created_at) WHERE published;
CREATE INDEX idx_gallery_albums_category ON gallery_albums (category) WHERE published;
