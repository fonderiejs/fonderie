-- Auto-recharge should charge the SPECIFIC card the buyer consented to at the
-- pack checkout, not merely the newest card on the customer (a multi-card
-- customer might have a newer, unrelated card). Persist that payment method so
-- the off-session charge targets it explicitly; a null falls back to the
-- customer's newest card (prior behavior).
ALTER TABLE fonderie_wallet_customers ADD COLUMN IF NOT EXISTS payment_method_id TEXT;
