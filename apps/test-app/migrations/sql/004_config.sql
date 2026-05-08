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

INSERT INTO fonderie_config (key, value, environment, description) VALUES
  ('maintenance.mode',     'false', 'all',         'Set to true to return 503 from /health'),
  ('ratelimit.multiplier', '1.0',   'all',         'Global rate-limit scale factor'),
  ('billing.trial_days',   '14',    'all',         'Default trial period in days'),
  ('billing.trial_days',   '30',    'production',  'Extended trial in production')
ON CONFLICT DO NOTHING;
