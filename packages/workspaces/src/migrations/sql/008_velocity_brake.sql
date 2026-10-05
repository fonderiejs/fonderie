-- The velocity brake (docs/INSIDER-THREAT-DESIGN.md, Phase 5): a manager who
-- deletes too much too fast — a scripted purge, a rogue in a hurry — is paused
-- from deleting anything more until the owner looks.
--
--   fonderie_workspace_destructive_actions — each successful destructive
--     action by someone who is not the owner (pruned after a day);
--   fonderie_workspace_brakes — who is paused, since when, after how many.
--
-- Additive only: the code serving during a deploy never reads these.
CREATE TABLE IF NOT EXISTS fonderie_workspace_destructive_actions (
  id           BIGSERIAL   PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  actor_id     UUID        NOT NULL,
  kind         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fonderie_wda_actor
  ON fonderie_workspace_destructive_actions (workspace_id, actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS fonderie_workspace_brakes (
  workspace_id UUID        NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL,
  actions      INT         NOT NULL,
  braked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
