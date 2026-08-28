-- 0011_investors.sql
-- Phase 2 readiness only. Phase 1 exposes no transactional investor features
-- and no investor account creation (§10); the table exists so the Phase 2
-- portal does not require a migration against live data.

CREATE TABLE investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  company_name VARCHAR(255),
  contact_person VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),

  invested_projects UUID[] NOT NULL DEFAULT '{}',
  total_investment NUMERIC(15,2),

  status investor_status NOT NULL DEFAULT 'prospect',
  notes TEXT,
  -- Investor records are retained for 2 years per the legal requirement (§11).
  retain_until TIMESTAMPTZ,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investors_status ON investors (status);
CREATE INDEX idx_investors_user ON investors (user_id);

CREATE TRIGGER trg_investors_updated_at
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
