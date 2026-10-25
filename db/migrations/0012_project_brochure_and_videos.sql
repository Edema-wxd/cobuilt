-- 0012_project_brochure_and_videos.sql
-- A downloadable brochure and YouTube timeline videos for each project,
-- shown on the project's Passport page.

ALTER TABLE projects
  ADD COLUMN brochure_url VARCHAR(512),
  ADD COLUMN timeline_video_urls TEXT[] NOT NULL DEFAULT '{}';
