-- Subscription webhook ordering guard. Providers deliver customer.subscription.*
-- events at-least-once with NO ordering guarantee, so a retried or out-of-order
-- event could resurrect a canceled/downgraded subscription by overwriting the
-- current row with stale state. Record the provider event's own timestamp so the
-- upsert can no-op any event that is older than the one already applied.
--
-- Nullable: legacy rows and non-webhook writers (checkout/cancel/reactivate) leave
-- it NULL, which the upsert treats as "no ordering basis, always apply" — only
-- webhook-vs-webhook races are guarded, never an app-initiated authoritative write.
ALTER TABLE fonderie_subscriptions
	ADD COLUMN IF NOT EXISTS provider_event_at TIMESTAMPTZ;
