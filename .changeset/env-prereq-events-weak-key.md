---
'@fonderie/events': minor
---

Readiness warns `WEAK_INTEGRITY_KEY` when the event integrity key is shorter than 32 characters or looks like a placeholder — the same rule core applies to every other secret. Any non-empty key used to pass, so a one-character key made the audit log's HMACs trivially forgeable while readiness reported it as signed. New `PGTransport.integrityKeyProblem()` exposes the verdict without exposing the key.
