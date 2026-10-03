-- An operator can DISMISS a dead delivery: "seen, and it must not be sent".
-- Dead rows used to have no way out — a delivery that should never go (a
-- verification code that expired weeks ago) kept the outbox check failing
-- forever. Dismissed rows keep their error and attempts for the record; they
-- leave the dead-letter list and are never claimed.
--
-- Additive: code that predates this never writes or reads 'dismissed'.
ALTER TABLE fonderie_event_consumers
	DROP CONSTRAINT IF EXISTS fonderie_event_consumers_status_check;
ALTER TABLE fonderie_event_consumers
	ADD CONSTRAINT fonderie_event_consumers_status_check
	CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead', 'dismissed'));
