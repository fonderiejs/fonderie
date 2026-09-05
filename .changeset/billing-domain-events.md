---
'@fonderie/billing': minor
---

Phase 1: billing publishes `fonderie.billing.*` domain events on the EventBus

`BillingModule` now accepts an optional `bus?: EventBus` (third constructor
argument) and, when given one, publishes domain events at its money-movement
points — subscription lifecycle (`subscription.created/updated/canceled/past_due`
from the webhook), credit-pack purchases (`credit_pack.purchased` +
`wallet.credited`), manual grants (`wallet.credited`), and periodic plan
grants (`grant.applied` + `wallet.credited`). Event keys are exported as
`EVENT_KEYS` / `BillingEventKey`.

This closes the "billing emits nothing subscribable" gap from the billing
capability audit: in-process consumers can now subscribe, and — because each
workspace-scoped payload carries a top-level `workspaceId` — `@fonderie/webhooks`
fans the same events out to a customer's own endpoints with no billing→webhooks
coupling. Money amounts are serialized as strings (payloads are JSON: persisted
and forwarded). Emission is fire-and-forget and skipped on idempotent replays,
so a bus hiccup or a webhook retry never breaks billing or double-fires.

Additive: `@fonderie/events` is an optional peer dependency; billing behaves
exactly as before when no `bus` is provided. Customer-facing receipts/notices
(courier `NOTIFICATION_EVENT`) and the refund/chargeback clawback are Phase 2/3.
