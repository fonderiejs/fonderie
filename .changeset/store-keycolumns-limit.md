---
"@fonderie/store": patch
---

Freeze-prep docs: document `IVersionedResource.keyColumns` as an intentional
fixed 2-tuple. Every versioned resource is addressed by exactly one primary key
plus one optional null-safe scope; composite 3+-part keys are out of scope by
design (model the extra dimension inside the primary key or scope). States the
limit as an owned contract ahead of freezing the surface.
