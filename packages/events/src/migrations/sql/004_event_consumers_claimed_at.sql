-- When a consumer claimed a row, so an abandoned claim can be reclaimed by
-- time rather than by a blanket reset of every 'processing' row. A reset
-- cannot distinguish a crashed instance's work from a live instance's work,
-- so it hands rows still being processed to a second consumer — which, for an
-- outbox that sends email, is a duplicate in someone's inbox.
ALTER TABLE fonderie_event_consumers
	ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Existing rows stuck in 'processing' predate the column and would otherwise
-- have claimed_at IS NULL, which no comparison against now() can ever match —
-- they would be stranded forever. Backdate them so the first poll reclaims them.
UPDATE fonderie_event_consumers
	SET claimed_at = '-infinity'
	WHERE status = 'processing' AND claimed_at IS NULL;

-- The stale-claim half of the poll predicate. The existing poll index covers
-- ('pending','failed'); this one keeps the reclaim path from scanning the
-- table once processed rows accumulate.
CREATE INDEX IF NOT EXISTS fonderie_event_consumers_stale_idx
	ON fonderie_event_consumers (consumer, claimed_at)
	WHERE status = 'processing';
