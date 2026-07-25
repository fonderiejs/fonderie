---
"@fonderie/core": minor
"@fonderie/auth": minor
"@fonderie/courier": minor
---

Add `app.checkProductionReadiness()` — one call that aggregates every module's
config footguns into a structured report (`{ ok, problems[] }`) you can gate a
deploy on or expose from a readiness endpoint, instead of relying on scattered
boot-time warnings. Modules opt in via an optional `IFonderieModule.checkReadiness()`;
core aggregates without importing them (`ok` is false on any `error`-severity
problem). Auth reports a weak/placeholder `jwtSecret` (error) and
`secureCookies: false` (warning); courier reports message types routed to a
channel with no provider (warning). The existing auto-guards (auth fails closed
in production, courier warns at boot) are unchanged — this adds the inspectable
data path alongside them.
