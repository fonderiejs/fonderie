---
"@fonderie/core": minor
---

Add `onResponse` — an opt-in config hook to adapt Fonderie's response contract. It transforms every JSON response body at the single egress point (adapter-agnostic; status, headers, and cookies preserved), so an app can serve its own shape — e.g. flatten Fonderie's `{ reason, explanation, result: { tokens, user } }` into a frontend's expected `{ user, accessToken, refreshToken }` — without editing any handler. Unset = unchanged behaviour. Surfaced by the crewfinding rewrite (Phase 1): the response envelope was the single biggest contract divergence, and this closes it with one config option instead of a per-app adapter, moving existing-frontend adoption toward drop-in.
