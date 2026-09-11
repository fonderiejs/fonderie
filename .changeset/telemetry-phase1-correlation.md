---
"@fonderie/logger": minor
"@fonderie/client": minor
---

Request correlation, end-to-end (telemetry Phase 1). The logger's request
middleware now honours an inbound `X-Request-ID` (client or load balancer) when
it's a bounded, safe token, generates one only if absent/unsafe, and **echoes it
in the response header** — so a single id threads the client call → server logs →
audit trail and can be quoted in a bug report. `@fonderie/client` sends
`X-Request-ID` on every request (uuid where available, a portable fallback for
React Native/Hermes) and surfaces it on `FonderieApiError.requestId`.
Metadata-only and pseudonymous — no payloads captured; IP-minimization policy and
retention are separate follow-ups.
