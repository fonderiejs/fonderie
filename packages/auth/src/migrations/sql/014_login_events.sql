-- Per-user login history: one append-only row per login attempt (success or
-- failure) across every method. Distinct from fonderie_sessions, which holds
-- only LIVE sessions and is swept on logout/expiry; this table is what the
-- "Login History" security screen reads. user_id is nullable so attempts
-- against unknown emails still record (they belong to no user's history but
-- matter for security analysis).
CREATE TABLE IF NOT EXISTS fonderie_login_events (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID REFERENCES fonderie_users(id) ON DELETE CASCADE,
	email_attempted TEXT,
	method TEXT NOT NULL,
	outcome TEXT NOT NULL,
	failure_reason TEXT,
	ip_address TEXT,
	user_agent TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fonderie_login_events_user_created
	ON fonderie_login_events (user_id, created_at DESC);
