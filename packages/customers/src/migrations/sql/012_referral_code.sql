-- Referral: a random, workspace-unique code each customer can share, plus a
-- nullable pointer to the customer who referred them (set at signup). The code
-- is 1:1 (one per customer); the relationship is 1:many (one referrer → many
-- referees, each referee has at most one referrer — enforced by the single FK).

ALTER TABLE fonderie_customers
	ADD COLUMN IF NOT EXISTS referral_code TEXT,
	ADD COLUMN IF NOT EXISTS referred_by   UUID REFERENCES fonderie_customers(id) ON DELETE SET NULL;

-- Same workspace-scoped uniqueness as reference_code: two workspaces may share a
-- code, but never two customers in the same workspace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fc_referral_code
	ON fonderie_customers (workspace_id, referral_code)
	WHERE referral_code IS NOT NULL;

-- Fast "who did this customer refer" lookups (the 1:many side).
CREATE INDEX IF NOT EXISTS idx_fc_referred_by
	ON fonderie_customers (referred_by);
