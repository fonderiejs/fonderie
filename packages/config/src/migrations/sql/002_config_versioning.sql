-- Version index + revision history for config entries (optimistic concurrency +
-- rollback). Each committed write bumps `version` and appends a revision row;
-- history is append-only and never mutated. `updated_by` records the actor.

ALTER TABLE fonderie_config
  ADD COLUMN IF NOT EXISTS version    INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE TABLE IF NOT EXISTS fonderie_config_revisions (
  key         TEXT        NOT NULL,
  environment TEXT        NOT NULL DEFAULT 'all',
  value       TEXT        NOT NULL,
  version     INT         NOT NULL,
  actor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key, environment, version)
);

CREATE INDEX IF NOT EXISTS fonderie_config_rev_key_env_idx
  ON fonderie_config_revisions (key, environment, version DESC);
