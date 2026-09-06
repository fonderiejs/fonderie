-- Phase 5a: split the wallet balance into a non-stackable subscription ALLOWANCE
-- (granted) and a stacking PURCHASED balance, without changing what `amount`
-- means. `amount` stays the TOTAL spendable balance so every existing reader and
-- ledger.balance_after are byte-identical; granted_amount is the sub-portion that
-- came from a periodic plan grant and expires at period end. purchased is derived
-- (amount - granted_amount) and is the only bucket a refund clawback ever touches.
--
-- Legacy rows get granted_amount = 0 by default, so everything anyone already
-- holds classifies wholly as purchased and NEVER expires. Pure wallet-only stays
-- byte-for-byte identical (granted_amount is always 0).

ALTER TABLE fonderie_wallet_balances
	ADD COLUMN IF NOT EXISTS granted_amount     BIGINT      NOT NULL DEFAULT 0,
	-- The grant period the current granted_amount belongs to (from
	-- currentGrantPeriod()); NULL = never granted. Period mismatch, not the
	-- timestamp below, is the authority for expiry.
	ADD COLUMN IF NOT EXISTS granted_period     TEXT,
	-- Advisory/display only: when the current allowance stops being spendable.
	ADD COLUMN IF NOT EXISTS granted_expires_at TIMESTAMPTZ,
	-- Per-subscriber toggle: when false, a debit may only draw the free allowance
	-- and is refused (402) once it is exhausted, even if purchased credits remain.
	ADD COLUMN IF NOT EXISTS spend_purchased    BOOLEAN     NOT NULL DEFAULT true;

-- granted_amount can never go negative (the debit clamps in-statement; this is
-- the backstop). Wrapped so a re-run of the migration is a no-op.
DO $$ BEGIN
	ALTER TABLE fonderie_wallet_balances
		ADD CONSTRAINT fonderie_wallet_balances_granted_nonneg_check CHECK (granted_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allowance expiry writes a signed-negative 'expiry' ledger row — add it to the
-- type CHECK. Drop/re-add is idempotent across re-runs.
ALTER TABLE fonderie_wallet_ledger DROP CONSTRAINT IF EXISTS fonderie_wallet_ledger_type_check;
ALTER TABLE fonderie_wallet_ledger
	ADD CONSTRAINT fonderie_wallet_ledger_type_check
	CHECK (type IN ('purchase', 'grant', 'usage', 'refund', 'adjustment', 'expiry'));
