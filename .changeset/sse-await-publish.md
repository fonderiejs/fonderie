---
'@fonderie/sse': patch
---

Bus events are now published **before** the bus handler settles, so a serverless producer no longer loses them.

**The bug:** found in production. The bus handler started the broadcaster's NOTIFY and returned at once. On Vercel the function is frozen as soon as its after-response work settles, so the NOTIFY often never left, while the bus had already marked the delivery processed. The event was lost with no error anywhere. Live config was unaffected, because it uses config's own NOTIFY channel; every *bus* event from a serverless producer was at risk (the first one seen was `fonderie.session.revoked`).

**The fix:** the handler awaits the publish. A failure now throws, so the bus retries instead of recording a delivery that didn't happen.
