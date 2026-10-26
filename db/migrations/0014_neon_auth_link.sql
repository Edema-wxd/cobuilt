-- Identity moves to Neon Auth (Managed Better Auth). `users` keeps what the
-- application owns — role, per-user permissions, is_active — and points at the
-- identity through auth_user_id (neon_auth."user".id). Passwords and sessions
-- now live in Neon Auth, so password_hash is no longer required.

ALTER TABLE users ADD COLUMN auth_user_id uuid;
CREATE UNIQUE INDEX idx_users_auth_user_id ON users (auth_user_id) WHERE auth_user_id IS NOT NULL;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Neon Auth issues and expires its own sessions.
DROP TABLE refresh_tokens;
