ALTER TABLE fonderie_users
  ADD COLUMN IF NOT EXISTS mfa_secret_pending            TEXT,
  ADD COLUMN IF NOT EXISTS mfa_secret_pending_expires_at TIMESTAMPTZ;
