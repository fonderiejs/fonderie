-- The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): a deleted endpoint is
-- kept here as a snapshot of its row for 30 days, restorable with the same id,
-- URL, events and signing secret. Its delivery history goes with the delete.
-- Only the workspace owner can remove a snapshot early; `emptyEndpointBin`
-- (the app's cron) removes the ones past the retention.
--
-- Additive only: the code serving during a deploy never reads it.
CREATE TABLE IF NOT EXISTS fonderie_webhook_endpoint_bin (
  id           UUID        PRIMARY KEY,
  workspace_id UUID        NOT NULL,
  snapshot     JSONB       NOT NULL,
  deleted_by   UUID,
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fonderie_webhook_endpoint_bin_ws
  ON fonderie_webhook_endpoint_bin (workspace_id, deleted_at DESC);
