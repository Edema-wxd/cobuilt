-- 0017_leadership_profiles.sql
-- Leadership profiles managed from the admin console and shown on /leadership
-- and the homepage spotlight.
--
-- 0007 created the table for CMS sync with a name, role, bio and photo. The
-- client's spec asks for more per leader — qualifications, areas of expertise
-- and a short profile — and for the page to show the organisational
-- structure, so each leader also carries the tier they sit in. Existing
-- columns are unchanged: the Strapi sync and the homepage spotlight read them
-- by name.

ALTER TABLE leadership
  -- One or two sentences for cards and the homepage spotlight; the bio is the
  -- full professional biography.
  ADD COLUMN summary VARCHAR(300),
  -- Degrees, professional memberships and certifications, one per entry.
  ADD COLUMN qualifications TEXT[] NOT NULL DEFAULT '{}',
  -- Areas of expertise, one per entry; shown as the card's remit.
  ADD COLUMN expertise TEXT[] NOT NULL DEFAULT '{}',
  -- A short attributed statement; optional.
  ADD COLUMN quote VARCHAR(300),
  -- Describes the portrait for screen readers; the name is used when absent.
  ADD COLUMN photo_alt VARCHAR(255),
  -- The organisational structure the page groups leaders by.
  ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'executive',
  -- Shown in the homepage leadership spotlight (published leaders only).
  ADD COLUMN featured BOOLEAN NOT NULL DEFAULT FALSE,
  -- When the CMS last wrote the row, as news_articles and projects record it.
  ADD COLUMN cms_synced_at TIMESTAMPTZ,

  ADD CONSTRAINT leadership_tier_valid CHECK (tier IN ('board', 'executive', 'management'));

-- Rows created before this migration came from the CMS.
UPDATE leadership SET cms_synced_at = updated_at WHERE cms_source IS NOT NULL;

-- The public page and the spotlight read published leaders in editorial order.
CREATE INDEX idx_leadership_published ON leadership (sort_order, created_at) WHERE published;
CREATE INDEX idx_leadership_featured ON leadership (sort_order) WHERE published AND featured;
