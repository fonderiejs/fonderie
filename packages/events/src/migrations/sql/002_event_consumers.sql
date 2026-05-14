-- Drop mutable delivery columns from fonderie_events (no-op on fresh installs)
ALTER TABLE fonderie_events
	DROP COLUMN IF EXISTS status,
	DROP COLUMN IF EXISTS attempts,
	DROP COLUMN IF EXISTS error,
	DROP COLUMN IF EXISTS processed_at;

DROP INDEX IF EXISTS fonderie_events_status_idx;

-- Per-consumer delivery tracking
CREATE TABLE IF NOT EXISTS fonderie_event_consumers (
	event_id      UUID        NOT NULL REFERENCES fonderie_events(id) ON DELETE CASCADE,
	consumer      TEXT        NOT NULL,
	status        TEXT        NOT NULL DEFAULT 'pending'
	                          CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead')),
	attempts      INT         NOT NULL DEFAULT 0,
	error         TEXT,
	processed_at  TIMESTAMPTZ,
	PRIMARY KEY (event_id, consumer)
);

-- Partial index — each consumer's poll touches only its own pending rows
CREATE INDEX IF NOT EXISTS fonderie_event_consumers_poll_idx
	ON fonderie_event_consumers (consumer, status, event_id)
	WHERE status IN ('pending', 'failed');
