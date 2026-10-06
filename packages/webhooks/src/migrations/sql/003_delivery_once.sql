-- One delivery row per (endpoint, event). The events outbox is at-least-once:
-- a consumer row whose dispatch did not finish is reclaimed and dispatched
-- again. Without this constraint every re-dispatch inserted a SECOND delivery
-- row and POSTed the same event to the customer's endpoint again. With it, the
-- insert is ON CONFLICT DO NOTHING and a re-dispatch reuses the row it finds.
--
-- Migrations run in a transaction; the lock keeps a dispatcher still running
-- the previous release from inserting a fresh duplicate between the cleanup
-- and the index build. It is held only for the length of this migration.
LOCK TABLE fonderie_webhook_deliveries IN SHARE ROW EXCLUSIVE MODE;

-- Existing duplicates must go before the unique index can be built. Keep the
-- row that says the most: one that was delivered, else the one with the most
-- attempts, else the oldest. The others are copies of the same event to the
-- same endpoint, so no event loses its delivery record.
DELETE FROM fonderie_webhook_deliveries d
 USING (
   SELECT id,
          row_number() OVER (
            PARTITION BY endpoint_id, event_id
            ORDER BY (status = 'delivered') DESC, attempts DESC, created_at, id
          ) AS rn
     FROM fonderie_webhook_deliveries
 ) ranked
 WHERE d.id = ranked.id
   AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fwhd_endpoint_event
	ON fonderie_webhook_deliveries (endpoint_id, event_id);

-- A 'pending' row is one whose first attempt has not been recorded. When the
-- process dies between the insert and that record, the retry loop claims it
-- once it is older than the lease; this keeps that half of the claim from
-- scanning the table.
CREATE INDEX IF NOT EXISTS idx_fwhd_pending
	ON fonderie_webhook_deliveries (created_at)
	WHERE status = 'pending';
