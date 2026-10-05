-- The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): a deleted customer is
-- kept here for 30 days as a snapshot of its row and everything attached
-- (emails, phones, addresses, notes, tags, relationships), restorable with the
-- same ids. Only the workspace owner removes one early; `emptyCustomerBin`
-- (the app's cron) removes the ones past the retention.
--
-- It holds personal data for those 30 days, as the data-retention policy says;
-- the account eraser does not reach it (customers are the business's records,
-- not the account's).
--
-- Additive only: the code serving during a deploy never reads it.
CREATE TABLE IF NOT EXISTS fonderie_customer_bin (
  id           UUID        PRIMARY KEY,
  workspace_id UUID        NOT NULL,
  snapshot     JSONB       NOT NULL,
  deleted_by   UUID,
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fonderie_customer_bin_ws
  ON fonderie_customer_bin (workspace_id, deleted_at DESC);
