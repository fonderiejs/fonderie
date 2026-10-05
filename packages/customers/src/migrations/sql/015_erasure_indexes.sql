-- Erasing an account clears its id from the customers it created and the
-- notes it wrote (docs/ACCOUNT-DELETION-DESIGN.md, Phase 4). Without these,
-- each erasure scans both tables. Additive: no running code reads them.
CREATE INDEX IF NOT EXISTS idx_fc_created_by
	ON fonderie_customers (created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fcn_author
	ON fonderie_customer_notes (author_id) WHERE author_id IS NOT NULL;
