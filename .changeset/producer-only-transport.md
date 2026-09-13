---
'@fonderie/events': minor
'@fonderie/auth': patch
'@fonderie/billing': patch
---

The durable outbox is now usable from a serverless producer, and a failing queue is no longer invisible.

`PGTransport.start()` bundled four things: connecting the store (needed to publish), resetting orphaned rows, opening a `LISTEN` client, and starting a poll loop that never returns. A serverless API needs only the first — but taking all four means every instance opens a `LISTEN` connection, which a transaction-mode pooler (Supabase's 6543) rejects outright, plus a loop the invocation cannot host. There was no way to say "connect me as a producer", so publishing durably from serverless was impossible. `consume: false` now stops after the store is connected. `drain()` still works in that mode, so a scheduled ping can consume without anything long-running.

`deadLetters()` and `pendingCount()` expose what the outbox knows but nothing surfaced. A dead row is the end of the line — durable, retried, and never to be delivered — yet a queue that has silently stopped delivering looked exactly like one with nothing to do, which is the failure mode an outbox exists to eliminate. Both answer emptily before the transport connects, so a health route can call them unconditionally.

Two remaining detached dispatches are fixed. `LoginEventModel.recordSafe` is now awaitable: it still never throws, but it is a security audit trail (who signed in, from where, from which IP), and a detached write is abandoned when a serverless instance freezes after the response — losing the row entirely rather than merely its IP. Billing's low-balance customer email went through `notifyBilling` rather than the bus, so the earlier sweep did not match it; it has the same exposure and now routes through `background()` too.
