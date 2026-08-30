-- Push notification tokens, one row per installation.
CREATE TABLE IF NOT EXISTS devices (
	id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id     uuid        NOT NULL,
	token       text        NOT NULL,
	platform    text        NOT NULL,
	app_version text,
	created_at  timestamptz NOT NULL DEFAULT now(),
	updated_at  timestamptz NOT NULL DEFAULT now(),

	-- The app re-registers on every launch because the OS can reissue a token at
	-- any time. Without this constraint that would insert a duplicate row on each
	-- start, and the user would receive one notification per launch they ever made.
	UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS devices_user_idx ON devices (user_id);
