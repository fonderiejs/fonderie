---
"@fonderie/core": minor
---

Freeze-prep: drop `_router` from `IFonderieContext`. The field was written onto
every context but **never read** anywhere — routing dispatches through
`routerMiddleware(router)`, which closes over the router directly. It only
leaked router internals into the (soon-to-be-frozen) public context contract and
forced every context-constructing adapter/test to carry `_router: null as any`
boilerplate. Removed from the interface, from both core construction sites, and
from the four adapter/billing test fixtures. No behaviour change.
