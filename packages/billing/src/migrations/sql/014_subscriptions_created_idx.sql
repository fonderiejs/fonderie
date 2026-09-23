-- The admin subscriber list pages by keyset on (created_at, id), the same
-- contract as the wallet ledger and the audit log. This table carried NO index
-- at all: every read so far was by (subscriber_type, subscriber_id), which the
-- planner served from a sequential scan of a small mirror. A keyset page is a
-- range scan, so without this every page sorts the whole table and the last
-- page is the most expensive one.
CREATE INDEX IF NOT EXISTS idx_fonderie_subscriptions_created_at_id
	ON fonderie_subscriptions (created_at DESC, id DESC);
