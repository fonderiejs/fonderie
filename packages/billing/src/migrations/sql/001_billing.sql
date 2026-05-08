CREATE TABLE IF NOT EXISTS fonderie_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  seats            INT,
  trial_days       INT NOT NULL DEFAULT 0,
  monthly_amount   INT,
  monthly_price_id TEXT,
  yearly_amount    INT,
  yearly_price_id  TEXT,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonderie_subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL UNIQUE,
  plan                     TEXT NOT NULL,
  interval                 TEXT NOT NULL DEFAULT 'month',
  status                   TEXT NOT NULL DEFAULT 'incomplete',
  provider_customer_id     TEXT,
  provider_subscription_id TEXT,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false,
  trial_ends_at            TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonderie_usage_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  metric       TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fonderie_usage_records_workspace_metric_idx
  ON fonderie_usage_records (workspace_id, metric, recorded_at);
