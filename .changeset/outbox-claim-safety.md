---
'@fonderie/events': patch
---

Fix two defects in the durable outbox that only appear once something actually consumes it.

`deadLetters()` selected `c.last_error`, but the column the transport writes is `error` — the query throws `column c.last_error does not exist` on any real database. It shipped green because the only thing that catches a wrong column name is a live Postgres: the SQL parses, the types line up, and the unit tests never connect. There is now a test that reads the migration files, collects the columns they create, and asserts every column the transport reads is one of them.

`drain()` reclaimed abandoned work by resetting every row in `processing` to `failed`, copying what `start()` does at boot. That is safe for a single worker starting up and wrong for `drain()`, whose entire purpose is serverless — where instances run it concurrently. Each invocation would take the rows the others were mid-send on and process them again, which for an outbox that sends email means the same message arriving twice. The reset is gone from both paths. Claiming now also picks up `processing` rows older than `claimTimeoutMs` (new, default 5 minutes), inside the existing `FOR UPDATE SKIP LOCKED` claim — so abandoned work still comes back, two consumers racing for the same stale row produce one winner, and recovery no longer requires a restart. Migration `004` adds the `claimed_at` column this needs, backdating any row already stuck in `processing` so the first poll picks it up.

`drain()` also answers emptily before the transport is connected, matching `deadLetters()` and `pendingCount()` — previously it dereferenced an unset store.
