CREATE TABLE IF NOT EXISTS fonderie_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'all',
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, environment)
);

CREATE INDEX IF NOT EXISTS fonderie_config_env_active_idx
  ON fonderie_config (environment, active);
