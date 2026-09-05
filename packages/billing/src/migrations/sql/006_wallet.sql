-- Stored-value wallet: balance cache, append-only ledger, periodic-grant
-- idempotency, and config-synced credit packs. All money amounts are BIGINT
-- in the smallest currency unit; the JS layer reads them as bigint.

-- Balance cache — fast read; NEVER written without a ledger row in the same
-- transaction. The ledger is the source of truth.
CREATE TABLE IF NOT EXISTS fonderie_wallet_balances (
	subscriber_type TEXT        NOT NULL,
	subscriber_id   UUID        NOT NULL,
	currency        TEXT        NOT NULL DEFAULT 'USD',
	amount          BIGINT      NOT NULL DEFAULT 0,
	version         BIGINT      NOT NULL DEFAULT 1,
	updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fonderie_wallet_balances_subscriber_type_check
		CHECK (subscriber_type IN ('user', 'workspace')),
	PRIMARY KEY (subscriber_type, subscriber_id, currency)
);

-- Append-only ledger — every balance mutation is one row here. amount is
-- signed: positive = credit, negative = debit. balance_after snapshots the
-- cache after this row applied. idempotency_key makes every mutation
-- replay-safe (retries hit the UNIQUE constraint and roll back).
CREATE TABLE IF NOT EXISTS fonderie_wallet_ledger (
	id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
	subscriber_type TEXT        NOT NULL,
	subscriber_id   UUID        NOT NULL,
	currency        TEXT        NOT NULL DEFAULT 'USD',
	type            TEXT        NOT NULL,
	amount          BIGINT      NOT NULL,
	balance_after   BIGINT      NOT NULL,
	description     TEXT,
	idempotency_key TEXT        NOT NULL UNIQUE,
	metadata        JSONB       NOT NULL DEFAULT '{}',
	provider_tx_id  TEXT,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fonderie_wallet_ledger_subscriber_type_check
		CHECK (subscriber_type IN ('user', 'workspace')),
	CONSTRAINT fonderie_wallet_ledger_type_check
		CHECK (type IN ('purchase', 'grant', 'usage', 'refund', 'adjustment')),
	CONSTRAINT fonderie_wallet_ledger_amount_nonzero_check
		CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS fonderie_wallet_ledger_subscriber_idx
	ON fonderie_wallet_ledger (subscriber_type, subscriber_id, currency, created_at DESC, id DESC);

-- Periodic-grant idempotency — one row per subscriber/currency/period marks
-- the period's grant as applied (written in the same transaction as its
-- ledger row, so the mark and the credit commit or roll back together).
CREATE TABLE IF NOT EXISTS fonderie_wallet_grants (
	subscriber_type TEXT        NOT NULL,
	subscriber_id   UUID        NOT NULL,
	currency        TEXT        NOT NULL,
	period          TEXT        NOT NULL,
	amount          BIGINT      NOT NULL,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	CONSTRAINT fonderie_wallet_grants_subscriber_type_check
		CHECK (subscriber_type IN ('user', 'workspace')),
	PRIMARY KEY (subscriber_type, subscriber_id, currency, period)
);

-- Credit packs — synced from IBillingConfig at boot (same pattern as
-- fonderie_plans). price_amount is in the provider's smallest unit.
CREATE TABLE IF NOT EXISTS fonderie_credit_packs (
	id           TEXT        PRIMARY KEY,
	name         TEXT        NOT NULL,
	currency     TEXT        NOT NULL DEFAULT 'USD',
	credits      BIGINT      NOT NULL,
	price_amount BIGINT      NOT NULL,
	price_id     TEXT,
	active       BOOLEAN     NOT NULL DEFAULT true,
	metadata     JSONB       NOT NULL DEFAULT '{}',
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-plan wallet economics (currency/precision/grants/rates) synced from
-- config for ops visibility; enforcement reads config at runtime like policy.
ALTER TABLE fonderie_plans ADD COLUMN IF NOT EXISTS wallet JSONB;

-- Plan display prices widen with the config move to bigint — an INT column
-- would fail boot for currencies whose minor-unit prices exceed 2^31. Reads
-- convert back to JS numbers behind a 2^53 guard; the wire stays numeric.
ALTER TABLE fonderie_plans
	ALTER COLUMN monthly_amount TYPE BIGINT,
	ALTER COLUMN yearly_amount TYPE BIGINT;
