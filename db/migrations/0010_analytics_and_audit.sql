-- 0010_analytics_and_audit.sql
-- First-party analytics and the admin audit trail.

CREATE TABLE page_views (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(64),
  page_path VARCHAR(512) NOT NULL,
  referrer VARCHAR(512),
  user_agent TEXT,
  -- NDPA data minimisation: the last octet is zeroed before insert (see
  -- src/lib/privacy.ts), so this column holds a truncated address only.
  ip_address INET,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_page_views_date ON page_views (viewed_at DESC);
CREATE INDEX idx_page_views_path ON page_views (page_path, viewed_at DESC);

-- Append-only trail for the actions the spec calls out (§3): deletions, role
-- changes, investor-content approvals, spam decisions.
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),  -- Denormalised: survives the actor being deleted
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_created ON audit_log (created_at DESC);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log (actor_id, created_at DESC);
