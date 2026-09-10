---
"@fonderie/courier": patch
---

Reject replayed Mailgun delivery webhooks. Mailgun signs only `timestamp + token` (not the body), so within the ±5-min freshness window a captured signature could be replayed with a forged body. The handler now records each accepted token until its window elapses and rejects a reuse. This is per-process (in-memory), so a multi-instance deployment gets same-instance protection with the freshness window still bounding exposure everywhere; a replay's impact is log/analytics integrity only. Also documents the resolver's escaping scope (element content + quoted attributes; not a URL/scheme sanitizer) as a guardrail for app template authors.
