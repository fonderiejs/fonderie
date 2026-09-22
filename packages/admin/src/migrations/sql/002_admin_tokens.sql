-- fonderie_admin_tokens: scoped, expiring, revocable tokens for the admin
-- surface. Only the hash is stored; the plaintext is shown once at issue.
-- The bootstrap adminToken (env) is the root and is not a row here.
CREATE TABLE IF NOT EXISTS fonderie_admin_tokens (
	id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	name         TEXT        NOT NULL,
	token_hash   TEXT        NOT NULL UNIQUE,   -- sha256 hex of the plaintext
	scopes       TEXT[]      NOT NULL,          -- subset of {read, write, secrets}
	created_by   TEXT        NOT NULL,          -- X-Actor at issue, else 'admin-token'
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	expires_at   TIMESTAMPTZ,                   -- NULL = never
	revoked_at   TIMESTAMPTZ,
	last_used_at TIMESTAMPTZ
);
