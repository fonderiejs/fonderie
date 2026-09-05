-- Off-session auto-recharge needs a card on file. On a credit-pack purchase we
-- persist the provider customer that holds the saved card, plus the per-
-- subscriber recharge guard state: the last attempt time (a cooldown so a
-- declined card can't be hammered), a consecutive-failure counter, and a
-- disable flag set once failures pile up (re-armed by the next purchase).
CREATE TABLE IF NOT EXISTS fonderie_wallet_customers (
	subscriber_type       TEXT        NOT NULL,
	subscriber_id         UUID        NOT NULL,
	provider              TEXT        NOT NULL,
	provider_customer_id  TEXT        NOT NULL,
	auto_recharge_disabled BOOLEAN    NOT NULL DEFAULT false,
	consecutive_failures  INT         NOT NULL DEFAULT 0,
	last_recharge_at      TIMESTAMPTZ,
	-- The idempotency key of an in-flight/unresolved off-session charge. Held
	-- across cooldown windows until the charge resolves definitively, so an
	-- INDETERMINATE outcome (lost response after capture) is retried with the
	-- SAME key and the provider dedupes it — never a second charge. Cleared on a
	-- definitive outcome (captured+credited, declined, or SCA).
	pending_recharge_key  TEXT,
	created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fonderie_wallet_customers_subscriber_type_check
		CHECK (subscriber_type IN ('user', 'workspace')),
	PRIMARY KEY (subscriber_type, subscriber_id, provider)
);
