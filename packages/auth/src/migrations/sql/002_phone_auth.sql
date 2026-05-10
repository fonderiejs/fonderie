-- Make email nullable to support phone-only users
ALTER TABLE fonderie_users ALTER COLUMN email DROP NOT NULL;

-- Track when phone was last verified via OTP
ALTER TABLE fonderie_users ADD COLUMN IF NOT EXISTS
	phone_verified_at TIMESTAMPTZ;

-- Unique constraint on phone (NULLs are distinct in PostgreSQL, so existing
-- rows with NULL phone are unaffected)
ALTER TABLE fonderie_users
	ADD CONSTRAINT fonderie_users_phone_unique UNIQUE (phone);

-- ── fonderie_phone_verifications ─────────────────────────────────
-- One pending OTP per phone number at a time (phone is the PK)
CREATE TABLE IF NOT EXISTS fonderie_phone_verifications (
	phone      TEXT        PRIMARY KEY,
	otp        TEXT        NOT NULL,
	expires_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
