---
'@fonderie/events': minor
---

`runWorker` — a queue consumer that deploys anywhere, so choosing a host is not
a code change.

Fonderie already owned the durable half: the outbox, exclusive claiming, the
visibility lease, retries, dead-lettering. What it left to each app was the last
mile — WHERE the consumer runs — and that has three different answers depending
on the platform, each failing silently in its own way:

- **always-on** (a VPS, Railway, a box you own) — nothing triggers it, so it
  must drain on its own schedule
- **scale-to-zero** (Cloud Run, Fly) — the platform wakes an instance with an
  HTTP REQUEST, so a worker that serves nothing can never be woken, and the
  cheap tier is unusable
- **run-once** (Cloud Run Jobs, a Kubernetes CronJob, GitHub Actions) — it must
  drain and EXIT, or the platform eventually records a timeout for work that
  actually succeeded

`runWorker` handles all three from one entrypoint: an interval for the first, a
secret-guarded `POST /drain` plus `GET /health` for the second, and `once: true`
for the third. The same image deploys to any of them.

It takes SEVERAL buses, because a worker process usually owns more than one
consumer (a job queue and a notification queue). Draining only one leaves the
others LISTENing, which silently defeats `once` — the work completes and the
process still hangs. That is not hypothetical; it is how this first failed.

Two further properties worth stating. Overlapping wakes coalesce into one pass
and re-run once afterwards, so several requests landing on one instance neither
duplicate work nor drop a wake that arrived mid-pass. And `stop()` finishes the
pass in flight before releasing the transport — scale-to-zero platforms SIGTERM
routinely, so abandoning mid-drain is the normal case, and rows left
`processing` would otherwise wait out their lease before anything retried them.

Setting `port` without `secret` throws at boot rather than serving an open
endpoint: the drain is the expensive half of the system, so an unauthenticated
one is a public "do work" button.

A drain-based worker also needs no `LISTEN`, so unlike a `start()` consumer it
runs against a transaction-mode pooler and can reuse the connection string the
publishing app already has.
