---
'@fonderie/rate-limit': patch
---

`MemoryStore` accepts an optional injectable clock — `new MemoryStore({ now })`, defaulting to `Date.now`. This makes the operation-triggered idle sweep deterministically testable and fixes a flaky test ("sweep evicts idle keys, keeps fresh ones") that raced the wall clock: the 1024 warm-up `consume()` calls could, under load, take longer than the rule's refill window, so early "fresh" keys aged past it and the sweep evicted them too, dropping the store below the asserted size. The default wall-clock behavior is unchanged.
