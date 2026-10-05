-- Every customer billing creates at the payment provider, recorded the moment
-- it is created, with the account whose email it was created with.
--
-- Before this, a provider customer was only findable through the row that
-- later pointed at it (a subscription, a wallet customer). Some never got one:
-- a card set up with the wallet off, an abandoned checkout. Those customers
-- held a person's email at the provider and nothing here knew they existed, so
-- erasing the person could not reach them (docs/ACCOUNT-DELETION-DESIGN.md, D7).
-- `created_by` is also how a WORKSPACE's customer created with one member's
-- email is found when that member's account is erased.
--
-- Additive: the code serving during a deploy never reads it.
CREATE TABLE IF NOT EXISTS fonderie_billing_customers (
	provider              TEXT        NOT NULL,
	provider_customer_id  TEXT        NOT NULL,
	subscriber_type       TEXT        NOT NULL,
	subscriber_id         UUID        NOT NULL,
	-- The account whose email the customer was created with (opaque id).
	created_by            UUID,
	created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
	-- Set when an account erasure deleted the customer at the provider.
	erased_at             TIMESTAMPTZ,
	CONSTRAINT fonderie_billing_customers_subscriber_type_check
		CHECK (subscriber_type IN ('user', 'workspace')),
	PRIMARY KEY (provider, provider_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_fbc_created_by
	ON fonderie_billing_customers (created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fbc_subscriber
	ON fonderie_billing_customers (subscriber_type, subscriber_id, created_at DESC);
