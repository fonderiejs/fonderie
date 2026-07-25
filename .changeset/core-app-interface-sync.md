---
"@fonderie/core": minor
---

Freeze-prep: sync the `IFonderieApp` contract with `FonderieApp` and enforce it.
The interface modules receive in `install(app)` was missing `boot()` and
`checkProductionReadiness()` — both are public on the class and part of the app
lifecycle — so a module typed against `IFonderieApp` couldn't call them. Added
both to the interface and made `FonderieApp implements IFonderieApp` so the two
can never silently drift again. Also removed a stale comment referencing a
`@fonderie-labs/auth` scope that isn't the plan; `ITenant`/`IAuthUser`/
`IWorkspace` are documented as the real core-owned identity contracts (auth and
workspaces populate them on the context). Additive — no consumer break.
