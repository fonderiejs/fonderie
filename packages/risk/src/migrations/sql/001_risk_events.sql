-- ----------------------------------------------------------------------------
-- 001_risk_events
-- ----------------------------------------------------------------------------
-- The engine's hashed-identity memory. One row per (assessment, signal
-- identifier): an assess() call writes a 'pending' row for each identifier it
-- was given; record() flips that assessment's rows to the real outcome. Reuse
-- and velocity signals are answered by querying (subject, signal_kind,
-- value_hash) against these rows.
--
-- PII firewall: every correlating value is stored as sha256(pepper ‖ kind ‖
-- value) — NEVER raw. Rows expire (expires_at, purged on a timer). Legal basis
-- is legitimate interest (fraud prevention); nothing here may flow into the
-- pseudonymous analytics/telemetry pipeline.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS risk_events (
	id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	assessment_id  UUID NOT NULL,        -- groups one assess() call's identifiers
	subject        TEXT NOT NULL,        -- 'trial.start' | 'auth.login' | …
	actor_id       UUID,                 -- the assessed principal, when known
	signal_kind    TEXT NOT NULL,        -- 'card' | 'ip' | 'device' | 'email-domain' | …
	value_hash     TEXT NOT NULL,        -- sha256(pepper ‖ kind ‖ value) — never raw
	outcome        TEXT NOT NULL DEFAULT 'pending'
		CHECK (outcome IN ('pending', 'allowed', 'challenged', 'blocked')),
	score          INTEGER,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	expires_at     TIMESTAMPTZ NOT NULL
);

-- The reuse/velocity lookup: "seen this identifier in this subject before?"
CREATE INDEX IF NOT EXISTS idx_risk_events_lookup
	ON risk_events (subject, signal_kind, value_hash);
-- record() resolves an assessment's rows by id.
CREATE INDEX IF NOT EXISTS idx_risk_events_assessment
	ON risk_events (assessment_id);
-- Retention purge.
CREATE INDEX IF NOT EXISTS idx_risk_events_expires
	ON risk_events (expires_at);
