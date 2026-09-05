-- Refund/chargeback clawback support. A refund or dispute event carries no
-- wallet metadata — its only link back to the original credit-pack purchase is
-- the provider transaction id (the PaymentIntent). The clawback path looks up
-- the purchase and sums prior reversals by provider_tx_id, so index it (it was
-- previously unindexed — every lookup was a seq scan on the ledger).
CREATE INDEX IF NOT EXISTS fonderie_wallet_ledger_provider_tx_id_idx
	ON fonderie_wallet_ledger (provider_tx_id)
	WHERE provider_tx_id IS NOT NULL;
