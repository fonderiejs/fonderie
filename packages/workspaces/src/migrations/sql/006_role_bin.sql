-- The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): a deleted custom role
-- is kept here for 30 days — the role, its permissions, who held it and who was
-- moved to the default role because of it — restorable with the same id. Only
-- the workspace owner removes one early; `emptyRoleBin` (the app's cron)
-- removes the ones past the retention.
--
-- Additive only: the code serving during a deploy never reads it.
CREATE TABLE IF NOT EXISTS fonderie_role_bin (
  id           UUID        PRIMARY KEY,
  workspace_id UUID        NOT NULL,
  snapshot     JSONB       NOT NULL,
  deleted_by   UUID,
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fonderie_role_bin_ws
  ON fonderie_role_bin (workspace_id, deleted_at DESC);
