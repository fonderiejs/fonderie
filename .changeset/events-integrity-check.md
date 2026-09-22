---
'@fonderie/events': minor
---

Offer the audit-chain integrity check to the doctor

With the Postgres transport, `describeAdmin().checks` now includes
`events.integrity`: `verifyEventChain` over the log. A row whose stored
HMAC does not match fails the check; rows published before integrity was
enabled are reported as advice; no `integrityKey` ⇒ skipped, and says so.
The check OPERATIONS.md asked you to schedule now has an address.
