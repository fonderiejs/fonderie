-- Sessions as devices, with safe refresh rotation (docs/SESSION-DESIGN.md, Phase 2).
--
-- `token` now holds the SHA-256 (hex) of the refresh token, never the token
-- itself: a database dump no longer contains working refresh tokens. Rows
-- written before this migration still hold the raw token; the code matches
-- either, so code and migration may land in any order. The UPDATE below
-- hashes them (a raw JWT contains dots; a hex digest never does).
--
-- A refresh now rotates the SAME row (one row per device) and remembers the
-- previous token's hash for a short grace: a retried or racing refresh still
-- succeeds; the previous token presented after the grace is a reuse — a theft
-- signal — and the session is revoked.
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS previous_token_hash  TEXT;
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS previous_valid_until TIMESTAMPTZ;
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS last_used_at         TIMESTAMPTZ;

UPDATE fonderie_sessions
   SET token = encode(sha256(convert_to(token, 'UTF8')), 'hex')
 WHERE position('.' in token) > 0;

CREATE INDEX IF NOT EXISTS idx_fonderie_sessions_previous_token_hash
	ON fonderie_sessions (previous_token_hash) WHERE previous_token_hash IS NOT NULL;
