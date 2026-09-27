-- fonderie_admin_operators: the PEOPLE who may sign in to the admin surface.
-- Deliberately separate from any application user table: signing up to the
-- app, or taking over an app account, can never produce an operator. There is
-- no registration — an operator is created by the one-time claim (root token,
-- zero operators) or by accepting an invite from another operator.
CREATE TABLE IF NOT EXISTS fonderie_admin_operators (
	id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	email             TEXT        NOT NULL UNIQUE,  -- lowercased
	name              TEXT,
	password_hash     TEXT        NOT NULL,         -- scrypt$N$r$p$salt$hash
	scopes            TEXT[]      NOT NULL,         -- subset of {read, write, secrets}
	totp_secret       TEXT,                         -- sealed with operatorKey when set
	totp_confirmed_at TIMESTAMPTZ,                  -- NULL = second factor not enrolled: no session yet
	totp_last_step    BIGINT,                       -- replay guard: a used time-step is refused
	backup_codes      TEXT[]      NOT NULL DEFAULT '{}',  -- sha256 of unused codes
	failed_attempts   INTEGER     NOT NULL DEFAULT 0,
	locked_until      TIMESTAMPTZ,
	created_by        TEXT        NOT NULL,
	created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_login_at     TIMESTAMPTZ,
	disabled_at       TIMESTAMPTZ
);

-- One row per browser session. The cookie holds a random id; only its hash is
-- stored. `stage` is 'password' (password checked, second factor pending),
-- 'enroll' (password checked, authenticator not yet set up) or 'active'.
-- Only 'active' opens anything.
CREATE TABLE IF NOT EXISTS fonderie_admin_sessions (
	id_hash      TEXT        PRIMARY KEY,
	operator_id  UUID        NOT NULL REFERENCES fonderie_admin_operators(id) ON DELETE CASCADE,
	stage        TEXT        NOT NULL,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	expires_at   TIMESTAMPTZ NOT NULL,            -- absolute cap; idle is checked from last_seen_at
	step_up_at   TIMESTAMPTZ,                     -- last fresh code, for dangerous actions
	client_ip    TEXT,
	user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS fonderie_admin_sessions_operator ON fonderie_admin_sessions (operator_id);

-- Single-use links. kind 'invite' creates an operator; kind 'recovery' lets an
-- existing one set a new password and re-enroll their authenticator (lost
-- password or lost device). Only the hash is stored; the token is shown once.
CREATE TABLE IF NOT EXISTS fonderie_admin_invites (
	id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	kind        TEXT        NOT NULL,             -- 'invite' | 'recovery'
	token_hash  TEXT        NOT NULL UNIQUE,
	email       TEXT        NOT NULL,
	scopes      TEXT[]      NOT NULL DEFAULT '{}',
	operator_id UUID        REFERENCES fonderie_admin_operators(id) ON DELETE CASCADE,
	created_by  TEXT        NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	expires_at  TIMESTAMPTZ NOT NULL,
	used_at     TIMESTAMPTZ
);
