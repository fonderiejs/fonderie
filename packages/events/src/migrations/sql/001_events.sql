CREATE TABLE IF NOT EXISTS fonderie_events (
	id            UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
	type          TEXT        NOT NULL,
	payload       JSONB       NOT NULL DEFAULT '{}',
	meta          JSONB       NOT NULL DEFAULT '{}',
	status        TEXT        NOT NULL DEFAULT 'pending'
	                          CHECK (status IN ('pending', 'processed', 'failed', 'dead')),
	attempts      INT         NOT NULL DEFAULT 0,
	error         TEXT,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
	processed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fonderie_events_status_idx
	ON fonderie_events (status, created_at)
	WHERE status IN ('pending', 'failed');
