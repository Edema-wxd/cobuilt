-- 0002_users_and_auth.sql
-- Users, refresh-token store and password-reset material.

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),

  -- Roles
  role user_role NOT NULL DEFAULT 'viewer',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Fine-grained ACLs

  -- Account state
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Credential recovery. Only hashes are stored: a leaked table must not yield
  -- a usable reset link.
  password_reset_token_hash VARCHAR(255),
  password_reset_expires_at TIMESTAMPTZ,
  email_verification_token_hash VARCHAR(255),

  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_email ON users (lower(email));
CREATE INDEX idx_users_active ON users (is_active);
CREATE INDEX idx_users_reset_token ON users (password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The spec (§3) requires POST /api/auth/logout to invalidate a token. A pure
-- stateless JWT cannot be invalidated, so refresh tokens are tracked here and
-- checked on every refresh; logout revokes the row. Access tokens stay
-- stateless and short-lived (15 min) as specified.
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,

  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  -- Set when this token is exchanged, so replaying a rotated token is
  -- detectable (token-reuse detection revokes the whole family).
  replaced_by UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,

  user_agent TEXT,
  ip_address INET
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expiry ON refresh_tokens (expires_at)
  WHERE revoked_at IS NULL;
