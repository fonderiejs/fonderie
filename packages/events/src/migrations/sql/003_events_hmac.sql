-- Tamper-evidence: per-row keyed HMAC over each event's immutable content.
-- NULL for rows written before integrity was enabled (verification skips them).
ALTER TABLE fonderie_events
	ADD COLUMN IF NOT EXISTS hmac TEXT;
