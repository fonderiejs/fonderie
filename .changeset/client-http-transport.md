---
"@fonderie/client": minor
---

feat(client): Fonderie-aware HTTP transport for custom endpoints

Adds a generic, authenticated transport to `FonderieClient` so an app's own
endpoints (on the same backend) get the same JWT + `X-Workspace-ID` as the typed
modules — no hand-rolled axios:

- `client.request({ method, path, body?, workspaceId? })`
- `client.get / post / put / patch / delete(path, …)`
- `client.setAccessToken(token)` and `client.setWorkspaceId(id)` (the latter also
  propagates to the workspace-scoped modules, so one call configures the client).

All calls return the standard `{ reason, explanation, result }` envelope and throw
`FonderieApiError`. Purely additive — existing typed methods are unchanged.
