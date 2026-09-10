---
"@fonderie/webhooks": patch
---

Cap stored delivery response bodies at 4 KiB. The receiving endpoint is caller-controlled and its response was buffered (`res.text()`) and persisted in full on every delivery and retry — unbounded memory use and `fonderie_webhook_deliveries` growth. The body is now read via a capped stream and truncated before storage; the field is diagnostic, so 4 KiB is ample.
