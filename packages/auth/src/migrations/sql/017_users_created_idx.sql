-- The admin user list pages by keyset on (created_at, id), the same contract as
-- login history and the audit log. Until now the only index on this table was
-- on email, which suits the lookups that existed — every read was one row by
-- email or id. A keyset page is a range scan, so without this every page sorts
-- the whole table and the last page costs the most.
CREATE INDEX IF NOT EXISTS idx_fonderie_users_created_at_id
	ON fonderie_users (created_at DESC, id DESC);
