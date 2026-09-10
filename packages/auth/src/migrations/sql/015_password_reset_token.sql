-- Re-introduce a high-entropy reset token ALONGSIDE the 6-digit pin (008 had
-- renamed the original token column into pin). The pin stays for the
-- code-entry UX (rate-limited at the route); the token backs a reset LINK
-- that needs no rate limit because it isn't brute-forceable. Nullable so
-- existing rows are valid; a partial unique index enforces uniqueness only
-- for the non-null tokens.
ALTER TABLE fonderie_password_resets ADD COLUMN IF NOT EXISTS token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fonderie_password_resets_token
	ON fonderie_password_resets (token)
	WHERE token IS NOT NULL;
