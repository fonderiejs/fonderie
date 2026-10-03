-- Windowed rate-limit counters for the 'db' counter backend.
--
-- The backend used to INSERT one fonderie_usage_records row per request and SUM
-- the whole window on every request, with nothing ever deleting a row: a
-- 100k/day limit meant up to 100k rows summed per request, growing forever.
-- 'memory' is no alternative on serverless, where every instance counts alone.
--
-- One row per (subscriber, metric, window): the window is the fixed,
-- epoch-aligned period that IBillingContext's resetsAt already advertises
-- (a '1d' limit resets at 00:00 UTC). A request upserts its row
-- (quantity = quantity + n) and reads the total back in the same statement.
-- expires_at = end of the window, so purgeUsageCounters() can drop dead rows;
-- NULL = a lifetime counter that never expires.
--
-- fonderie_usage_records is untouched: it stays the ledger behind POST
-- /billing/usage (recordUsage / getUsage).
CREATE TABLE IF NOT EXISTS fonderie_usage_counters (
	subscriber_type TEXT        NOT NULL,
	subscriber_id   TEXT        NOT NULL,
	metric          TEXT        NOT NULL,
	-- The window's length (0 = lifetime). Part of the key: a 1h and a 1d
	-- window both start at 00:00 UTC, and must not share a row.
	window_ms       BIGINT      NOT NULL,
	window_start    TIMESTAMPTZ NOT NULL,
	quantity        BIGINT      NOT NULL DEFAULT 0,
	expires_at      TIMESTAMPTZ,
	PRIMARY KEY (subscriber_type, subscriber_id, metric, window_ms, window_start)
);

CREATE INDEX IF NOT EXISTS idx_fonderie_usage_counters_expires_at
	ON fonderie_usage_counters (expires_at)
	WHERE expires_at IS NOT NULL;
