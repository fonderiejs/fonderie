-- Auto-recharge idempotency-key TTL guard. An indeterminate ('unknown') charge
-- outcome keeps its idempotency key pending so the next window retries with the
-- SAME key and the provider dedupes to the original PaymentIntent — no double
-- charge. But provider idempotency keys EXPIRE (~24h at Stripe): past that,
-- reusing the key no longer dedupes — the provider mints a NEW charge, which
-- double-charges if the original actually captured. Record WHEN the pending key
-- was minted so the claim can refuse to reuse one that has aged past the
-- provider's retention window.
--
-- Nullable: only set while a key is pending, cleared alongside it. Legacy rows
-- and the no-pending-key steady state leave it NULL.
ALTER TABLE fonderie_wallet_customers
	ADD COLUMN IF NOT EXISTS pending_recharge_key_at TIMESTAMPTZ;
