CREATE TABLE IF NOT EXISTS fonderie_rate_limits (
	key            TEXT             NOT NULL PRIMARY KEY,
	tokens         DOUBLE PRECISION NOT NULL,
	last_refill_ms DOUBLE PRECISION NOT NULL,
	granted        BOOLEAN          NOT NULL DEFAULT TRUE
);

-- Opportunistic cleanup scans by idle time.
CREATE INDEX IF NOT EXISTS fonderie_rate_limits_refill_idx
	ON fonderie_rate_limits (last_refill_ms);
