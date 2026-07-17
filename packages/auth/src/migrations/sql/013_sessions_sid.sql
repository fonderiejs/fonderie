-- Session-backed access-token revocation: access tokens carry the sid of
-- the refresh session they were issued with; withSession() rejects access
-- tokens whose session row is gone (logout, rotation, password change).
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS sid UUID;
CREATE INDEX IF NOT EXISTS idx_fonderie_sessions_sid ON fonderie_sessions (sid);
