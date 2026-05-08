-- ── fonderie_users ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fonderie_users (
	id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	email             TEXT        NOT NULL UNIQUE,
	password_hash     TEXT,
	first_name        TEXT,
	last_name         TEXT,
	phone             TEXT,
	profile_image_url TEXT,
	locale            TEXT        NOT NULL DEFAULT 'en-US',
	timezone          TEXT        NOT NULL DEFAULT 'UTC',
	provider          TEXT,
	provider_id       TEXT,
	is_active         BOOLEAN     NOT NULL DEFAULT true,
	last_login        TIMESTAMPTZ,
	skills            JSONB       NOT NULL DEFAULT '[]',
	preferences       JSONB       NOT NULL DEFAULT '{"notifications":{"email":true,"inApp":true,"sms":false,"push":false},"emailDigest":"immediate","dateFormat":"MM/DD/YYYY","timeFormat":"hh:mm A"}',
	suspended         BOOLEAN     NOT NULL DEFAULT false,
	whitelist         BOOLEAN     NOT NULL DEFAULT false,
	ip_whitelist      JSONB       NOT NULL DEFAULT '[]',
	mfa_enabled       BOOLEAN     NOT NULL DEFAULT false,
	mfa_secret        TEXT,
	email_verified_at TIMESTAMPTZ,
	deleted_at        TIMESTAMPTZ,
	created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fonderie_users_email ON fonderie_users (email);

-- ── fonderie_email_verifications ─────────────────────────────────
CREATE TABLE IF NOT EXISTS fonderie_email_verifications (
	token      TEXT        PRIMARY KEY,
	user_id    UUID        NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── fonderie_password_resets ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS fonderie_password_resets (
	user_id    UUID        PRIMARY KEY REFERENCES fonderie_users(id) ON DELETE CASCADE,
	token      TEXT        NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fonderie_password_resets_token ON fonderie_password_resets (token);

-- ── fonderie_sessions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fonderie_sessions (
	id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id    UUID        NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
	token      TEXT        NOT NULL UNIQUE,
	user_agent TEXT,
	ip_address TEXT,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fonderie_sessions_user_id    ON fonderie_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_fonderie_sessions_token      ON fonderie_sessions (token);
CREATE INDEX IF NOT EXISTS idx_fonderie_sessions_expires_at ON fonderie_sessions (expires_at);

-- ── fonderie_mfa_challenges ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS fonderie_mfa_challenges (
	token      TEXT        PRIMARY KEY,
	user_id    UUID        NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
	expires_at TIMESTAMPTZ NOT NULL,
	used_at    TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fonderie_mfa_challenges_user_id    ON fonderie_mfa_challenges (user_id);
CREATE INDEX IF NOT EXISTS idx_fonderie_mfa_challenges_expires_at ON fonderie_mfa_challenges (expires_at);
