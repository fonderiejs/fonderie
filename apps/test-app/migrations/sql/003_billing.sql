CREATE TABLE IF NOT EXISTS fonderie_plans (
	id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name             TEXT NOT NULL UNIQUE,
	seats            INTEGER,
	trial_days       INTEGER NOT NULL DEFAULT 0,
	monthly_amount   NUMERIC(10,2),
	monthly_price_id TEXT,
	yearly_amount    NUMERIC(10,2),
	yearly_price_id  TEXT,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fonderie_subscriptions (
	id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	workspace_id             UUID NOT NULL UNIQUE REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
	plan                     TEXT NOT NULL DEFAULT 'free',
	interval                 TEXT NOT NULL DEFAULT 'month',
	status                   TEXT NOT NULL DEFAULT 'active',
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
	workspace_id UUID NOT NULL REFERENCES fonderie_workspaces(id) ON DELETE CASCADE,
	metric       TEXT NOT NULL,
	quantity     INTEGER NOT NULL DEFAULT 1,
	recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
