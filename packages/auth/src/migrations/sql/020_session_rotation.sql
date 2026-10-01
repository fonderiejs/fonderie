-- Sessions as devices, with safe refresh rotation (docs/SESSION-DESIGN.md, Phase 2).
--
-- `token` now holds the SHA-256 (hex) of the refresh token, never the token
-- itself: a database dump no longer contains working refresh tokens. Rows
-- written before this release still hold the raw token: the code matches
-- either, and hashes such a row on its next refresh; idle ones expire within
-- the session lifetime. Deliberately NOT hashed here: the code still running
-- during a deploy looks sessions up by the raw token, so hashing them in the
-- migration would fail every refresh — and sign users out — until the new
-- code is live. This migration only ADDS columns, harmless to that code, so
-- the order is simply: migrate, then deploy.
--
-- A refresh now rotates the SAME row (one row per device) and remembers the
-- previous token's hash for a short grace: a retried or racing refresh still
-- succeeds; the previous token presented after the grace is a reuse — a theft
-- signal — and the session is revoked.
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS previous_token_hash  TEXT;
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS previous_valid_until TIMESTAMPTZ;
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS last_used_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fonderie_sessions_previous_token_hash
	ON fonderie_sessions (previous_token_hash) WHERE previous_token_hash IS NOT NULL;
