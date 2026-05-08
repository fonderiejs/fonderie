CREATE TABLE IF NOT EXISTS fonderie_config (
	key         TEXT NOT NULL,
	value       JSONB NOT NULL,
	environment TEXT NOT NULL DEFAULT 'all',
	description TEXT,
	active      BOOLEAN NOT NULL DEFAULT true,
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (key, environment)
);

INSERT INTO fonderie_config (key, value, environment, description) VALUES
('maintenance.mode',   'false', 'all',        'Kill switch for all traffic'),
('ratelimit.multiplier', '1.0', 'all',         'Global rate limit scale factor'),
('billing.trial_days',  '14',  'all',         'Default trial period in days'),
('billing.trial_days',  '30',  'production',  'Extended trial in production')
ON CONFLICT DO NOTHING;
