-- Handing a team over waits for the new owner (docs/INSIDER-THREAT-DESIGN.md,
-- Phase 4): the owner OFFERS ownership (after confirming it's them), the
-- member accepts — or declines, or the owner withdraws it, or it lapses after
-- seven days. One open offer per workspace; a new one replaces it.
--
-- Additive only: the code serving during a deploy never reads it.
CREATE TABLE IF NOT EXISTS fonderie_workspace_ownership_offers (
  workspace_id UUID        PRIMARY KEY REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
  from_user_id UUID        NOT NULL,
  to_user_id   UUID        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
