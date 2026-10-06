-- Which claim a 'processing' row currently belongs to. A new token is drawn on
-- every claim, and a handler's outcome is written only while the row still
-- carries the token it was claimed with.
--
-- Without it, a handler that outlived claimTimeoutMs had its row reclaimed by
-- another consumer, and then overwrote the newer outcome when it finally
-- returned: a late failure turned a processed row back into 'failed' (so it was
-- run yet again), and a late success revived a row already buried as dead.
--
-- Additive: code that predates this never reads or writes the column, and a
-- row claimed by that code is only ever finished by that same code.
ALTER TABLE fonderie_event_consumers
	ADD COLUMN IF NOT EXISTS claim_token UUID;
