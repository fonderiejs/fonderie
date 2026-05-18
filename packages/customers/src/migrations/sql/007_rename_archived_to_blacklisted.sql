ALTER TABLE fonderie_customers RENAME COLUMN is_archived TO is_blacklisted;

DROP INDEX IF EXISTS idx_fc_workspace_archived;
CREATE INDEX IF NOT EXISTS idx_fc_workspace_blacklisted
	ON fonderie_customers (workspace_id, is_blacklisted);
