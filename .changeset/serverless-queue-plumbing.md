---
'@fonderie/adapter-express': minor
'@fonderie/adapter-hono': minor
'@fonderie/adapter-koa': minor
'@fonderie/courier': minor
'@fonderie/events': minor
'@fonderie/core': minor
---

Move the serverless queue plumbing into the bricks, where it belongs.

Getting a Fonderie app to actually deliver its queued work on serverless took five separate discoveries, each of which had to be made by breaking production: that the platform offers a `waitUntil` primitive and it must be wired; that the transport needs `consume: false` there; that something has to drain after the response; that the queue is **not** a record of whether email was sent; and that a deploy landing ahead of its migrations makes every drain fail with an error that reads like a broken queue.

None of that is app-specific, and two apps in this repo had already hand-written it — divergently, with the second copy silently swallowing the error the first one explained. That is the duplication the brick model exists to remove.

- `installPlatformBackgroundRunner()` (**core**) wires the platform's keep-alive primitive when there is one. No-op elsewhere, and a missing vendor package is not an error.
- `drainQueue(bus)` (**all three adapters**) drains after the response, never before — draining first would make every caller wait on someone else's work. One drain in flight per instance; failures can never fail the request that triggered them.
- `pendingByConsumer()` (**events**) reports backlog per consumer **with the age of the oldest row**. A single total conflates queues that share the table, and "1 waiting" reads very differently from "1 waiting, 200 minutes old".
- `explainDrainFailure()` (**events**) names the migration-ordering cause, which is the common one and the one whose symptom is most misleading.
- `messageStats()` (**courier**) answers "did mail actually go out", from the log courier owns. Apps were reaching into `fonderie_message_log` with raw SQL to ask — coupling to another package's schema, which is exactly how a wrong column name shipped earlier.
