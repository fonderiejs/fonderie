---
'@fonderie/events': minor
---

Offer the outbox check to the doctor

With the Postgres transport, `describeAdmin().checks` includes
`events.outbox`: a dead letter fails the check — it will never be delivered
and nothing else is looking — and a consumer backlog older than fifteen
minutes is reported as advice, since the per-request drain should have taken
it. The memory transport offers nothing.
