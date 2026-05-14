CREATE TABLE IF NOT EXISTS fonderie_events (
	id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
	type        TEXT        NOT NULL,
	payload     JSONB       NOT NULL DEFAULT '{}',
	meta        JSONB       NOT NULL DEFAULT '{}',
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fonderie_events_created_idx
	ON fonderie_events (created_at);
