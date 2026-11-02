-- 0016_site_settings.sql
-- Site content an administrator changes in the console rather than in code.
-- One JSONB document per key; 'homepage' holds the landing page's hero copy,
-- featured YouTube video, statistics overrides and section switches.
--
-- The document's shape is owned by src/lib/schemas/settings.ts, which
-- validates it on write and reads it leniently (missing fields take their
-- defaults), so a later field needs no migration and an absent key simply
-- means "as built".

CREATE TABLE site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT site_settings_value_is_object CHECK (jsonb_typeof(value) = 'object')
);

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
