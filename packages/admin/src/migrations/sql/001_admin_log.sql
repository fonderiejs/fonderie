-- fonderie_admin_log: every request served by the admin surface, including
-- the ones the token guard refused. Append-only; the operator reads it.
CREATE TABLE IF NOT EXISTS fonderie_admin_log (
	id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	at          TIMESTAMPTZ NOT NULL DEFAULT now(),
	actor       TEXT        NOT NULL,            -- X-Actor header, or 'admin-token'
	method      TEXT        NOT NULL,
	path        TEXT        NOT NULL,            -- request pathname, no query string
	route       TEXT        NOT NULL,            -- the pattern, relative to basePath: /_admin/secrets/:key/reveal
	module      TEXT        NOT NULL,            -- who described the route
	status      INTEGER     NOT NULL,
	duration_ms INTEGER     NOT NULL,
	request_id  TEXT,
	client_ip   TEXT
);

CREATE INDEX IF NOT EXISTS idx_fonderie_admin_log_at
	ON fonderie_admin_log (at DESC, id DESC);
