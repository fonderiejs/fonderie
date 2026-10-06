---
'@fonderie/events': patch
'@fonderie/webhooks': patch
---

**events:** a handler that ran longer than `claimTimeoutMs` no longer overwrites the outcome of the consumer that took its row over. Its row was reclaimed, and when the slow handler finally returned it wrote on top of the newer result: a late failure turned a processed row back into `failed` (so the work ran again), and a late success revived a row already buried as dead. Every claim now carries a claim token (additive migration `006_event_consumers_claim_token.sql`), outcomes are written only while the row is still `processing` under that token, and a lost claim is logged with a hint to raise `claimTimeoutMs`.

**webhooks:** an event is delivered to an endpoint once, and a delivery is never silently lost.

- A re-dispatched event (the outbox re-runs a dispatch that did not finish) no longer inserts a second delivery row and POSTs the same event to the customer's endpoint again. Migration `003_delivery_once.sql` removes existing duplicates — keeping the delivered row, else the one with the most attempts, else the oldest — and adds a unique `(endpoint_id, event_id)`; the insert is `ON CONFLICT DO NOTHING`.
- A delivery whose process died between recording it and its first attempt is now retried. It stayed `pending` forever, because the retry loop only claimed `failed` rows; `pending` rows older than the retry lease are claimed too.
- A delivery row that cannot be written now fails the dispatch, so the outbox retries the event. The failure used to be swallowed, the event was marked processed, and that webhook was gone with nothing left to retry it.
