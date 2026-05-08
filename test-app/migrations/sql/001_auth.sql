CREATE TABLE IF NOT EXISTS fonderie_users (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email            TEXT NOT NULL UNIQUE,
	password_hash    TEXT,
	provider         TEXT,
	provider_id      TEXT,
	suspended        BOOLEAN NOT NULL DEFAULT false,
	mfa_enabled      BOOLEAN NOT NULL DEFAULT false,
	mfa_secret       TEXT,
	email_verified_at TIMESTAMPTZ,
	deleted_at       TIMESTAMPTZ,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonderie_email_verifications (
	token      TEXT PRIMARY KEY,
	user_id    UUID NOT NULL REFERENCES fonderie_users(id) ON DELETE CASCADE,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonderie_password_resets (
	user_id    UUID PRIMARY KEY REFERENCES fonderie_users(id) ON DELETE CASCADE,
	token      TEXT NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
