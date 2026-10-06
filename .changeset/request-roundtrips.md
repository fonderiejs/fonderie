---
'@fonderie/auth': patch
'@fonderie/workspaces': patch
'@fonderie/permissions': patch
'@fonderie/billing': minor
---

Fewer database round-trips per request, and registration can no longer strand an account.

- An ordinary signed-in, workspace-scoped request (session → billing → workspace → manager check → permission check) now costs 6 queries instead of 11–12 (measured):
  - `@fonderie/auth`: the session's liveness and the account are read in one query (2 → 1).
  - `@fonderie/workspaces`: `withWorkspace` reads the workspace, the membership and the member's system roles in one query (2 → 1); `requireManager` decides from those roles for the same request instead of asking again (1 → 0 for non-owners).
  - `@fonderie/permissions`: `engine.can()` reads membership, super-role, system roles and the stored grant in one query (2–4 → 1).
  - `@fonderie/billing`: all of a plan's windowed counters are incremented in one statement with the `'db'` backend (N → 1). Custom counter backends may implement the new optional `incrementMany()`; without it they are called once per counter, as before.
  Same answers, status codes and reasons; nothing is cached beyond the request.
- `@fonderie/auth`: registration writes the account and its verification code in one transaction (email and phone). A failure between the two used to leave an account with no code — it could not be verified and its address could not be registered again. Messages and events still go out only after the commit.
