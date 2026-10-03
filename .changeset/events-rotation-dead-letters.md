---
'@fonderie/events': minor
'@fonderie/client': patch
---

**Rotating the integrity key no longer makes history look tampered.** The event log was verified against one key, so after a rotation every row signed before it failed: the `events.integrity` check reported authentic events as tampered. New `retiredIntegrityKeys` (on the `pg` transport config and `PGTransport`; `retiredKeys` on `startIntegrityCheck`): keys used to VERIFY older rows only, never to sign. Such rows are counted as `retiredKey` in the report, shown as advice (`EVENTS_RETIRED_KEY`), and never as tampered. A row that matches no key is still tampered: a retired key does not launder an edit.

**No delivery is silently lost in limbo.** Claiming requires `attempts < maxRetries`, and only a handler that throws on its last attempt marked a row `dead`. A row whose last attempt never finished (the instance was killed mid-send) stayed `processing` forever: not retried, not dead, missing from both the dead-letter list and the backlog. Rows an older release reset to `failed` with spent attempts were stuck the same way. Each poll now marks those rows `dead`, with a recorded reason, once their lease has expired. Rows that still have attempts left are untouched.

**Dead deliveries have a way out.** `PGTransport.retryDead(eventId, consumer)` gives a dead row a full set of attempts; `dismissDead(eventId, consumer)` retires it for good, keeping its error for the record. Migration `005_event_consumers_dismissed.sql` adds the `dismissed` status (additive). Operator routes, mounted by `@fonderie/admin`: `GET /_admin/events/dead`, `POST /_admin/events/dead/:eventId/:consumer/retry` and `…/dismiss`. Before this, a dead row kept the outbox check failing until someone edited the table by hand.
