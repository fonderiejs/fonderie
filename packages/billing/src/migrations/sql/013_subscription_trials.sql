-- Durable trial-eligibility ledger. A subscription row is overwritten on every
-- cancel → resubscribe, so it can't remember that a subscriber already consumed
-- a free trial — which let a subscriber farm unlimited trials (and, since
-- trialing is grant-eligible, a fresh wallet grant each period) by repeatedly
-- cancelling and re-subscribing. This table records, once and durably, that a
-- subscriber has had a trial; checkout consults it before applying trialDays.
--
-- One row per subscriber (idempotent insert), written by the subscription
-- webhook when a subscription actually enters a trial. Never deleted.
CREATE TABLE IF NOT EXISTS fonderie_subscription_trials (
	subscriber_type TEXT        NOT NULL,
	subscriber_id   UUID        NOT NULL,
	consumed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (subscriber_type, subscriber_id),
	CONSTRAINT fonderie_subscription_trials_subscriber_type_check
		CHECK (subscriber_type IN ('user', 'workspace'))
);
