-- Tracks which threshold notifications have been sent per subscriber/key/window.
-- Prevents duplicate emails when a subscriber hovers around a threshold.
CREATE TABLE IF NOT EXISTS fonderie_billing_notifications (
	id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	subscriber_type TEXT        NOT NULL,
	subscriber_id   UUID        NOT NULL,
	policy_key      TEXT        NOT NULL,
	notification    TEXT        NOT NULL,   -- 'warning' | 'reached' | 'blocked'
	window_key      TEXT        NOT NULL,   -- e.g. '2026-05-13' for a 1-day window
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fonderie_billing_notifications_unique
		UNIQUE (subscriber_type, subscriber_id, policy_key, notification, window_key)
);
