---
'@fonderie/webhooks': minor
---

Retries no longer deliver the same webhook twice, and can now be driven where timers cannot run.

`claimForRetry` was a plain `SELECT` — it claimed nothing. Every concurrent caller read the same due rows and delivered them all. One long-running server with one timer never noticed; more than one of anything — several warm serverless instances, or a container plus a scheduled ping — sent the customer's endpoint the same webhook repeatedly. Webhooks are outward-facing, so that duplicate is someone else's system acting on the same event twice.

It now claims exclusively (`FOR UPDATE ... SKIP LOCKED`) and leases the row by pushing `next_attempt_at` forward, which doubles as crash recovery: `markResult` overwrites it with the real backoff, and a process that dies mid-attempt simply leaves the row to become due again. Verified against a live database — two concurrent passes over one due row claimed it twice before the fix and exactly once after.

`WebhooksModule.retry()` is now public. Retries were driven solely by `setInterval`, which never reliably fires on serverless because the instance is frozen between requests — and nothing exposed a manual pass, so those deployments had no recourse at all and a failed delivery was simply never retried. A scheduled ping can call this; it is safe alongside the timer, since claims are exclusive.

`WebhooksModule.stop()` clears the retry interval, which was created and never cleared.
