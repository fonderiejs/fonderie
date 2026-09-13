---
'@fonderie/courier': patch
---

Await the message-log status writes, so a send's outcome is not lost on serverless.

`markMessageSent` and `markMessageFailed` were detached. On a long-running host they land a moment later and nobody notices; on serverless the instance is frozen the moment the handler returns, so the write is routinely abandoned and the row sits at `pending` forever. The send had already happened — only the record of it was lost.

That is the worst direction for this table to be wrong in, because it is the **only** evidence a send occurred: courier catches a send failure and does not rethrow, so the event bus marks its row `processed` whether the message went out or not. Anything asking "is email working" has to read `fonderie_message_log`, and it was under-reporting successes exactly where it mattered.

Awaiting costs nothing that matters — this runs in the consumer, not on the request path.

Both writes are covered by tests that fail against the detached version. The assertion is that **dispatch is still pending while the write is in flight**, not merely that the write eventually lands: a detached write lands too, just after dispatch has returned, which on serverless means never.
