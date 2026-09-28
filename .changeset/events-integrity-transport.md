---
'@fonderie/events': patch
---

The integrity check and the readiness warning now read the key from the transport itself. They read it from a `{ type: 'pg' }` config object only, so an app that hands `EventsModule` its own `PGTransport` (to keep a handle for dead-letter and backlog checks) was always reported as "no integrityKey — not tamper-evident", whatever that transport was signing with, and never warned when it really had no key. Verification now runs inside the transport (`verifyIntegrity()`), so the key never leaves it; `hasIntegrityKey()` reports whether it signs.
