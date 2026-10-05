-- Archive: a customer who still has jobs, quotes or invoices cannot be deleted
-- (those documents must keep pointing at someone), but the business can stop
-- seeing them — hidden from lists and pickers, kept on every document.
ALTER TABLE fonderie_customers
	ADD COLUMN IF NOT EXISTS is_archived BOOLEAN     NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fc_workspace_archived
	ON fonderie_customers (workspace_id, is_archived);
