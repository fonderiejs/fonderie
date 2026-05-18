DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fonderie_customers' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE fonderie_customers RENAME COLUMN is_archived TO is_blacklisted;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_fc_workspace_archived;
CREATE INDEX IF NOT EXISTS idx_fc_workspace_blacklisted
	ON fonderie_customers (workspace_id, is_blacklisted);
