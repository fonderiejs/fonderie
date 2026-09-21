---
'@fonderie/core': minor
---

Reserve a route prefix, and list the route table

The router is first-match-wins and says nothing when two routes share a path.
Today that is survivable because there is no namespace anyone competes for —
but the admin surface (`docs/ADMIN-BRICK-DESIGN.md`) needs one, and the
built-in probes have always been exposed to it: a module mounting `/healthz`
during `install()` is registered *before* core's probe and silently shadows it.
The platform keeps hitting a route that says 200 for the wrong reason.

Non-collision is now a **boot-time assertion**, not a convention to remember —
the same shape as the `fonderie_` table guard in `@fonderie/store`.

- `app.reserve(prefix)` — called from `install()`, claims `prefix` (relative to
  `basePath`, like `addRoute`) for the installing module. Any other module
  mounting under it fails at *its* `addRoute` with a message naming both sides;
  reserving over a route another module already mounted fails the same way. So
  order does not matter: whichever comes second, boot throws. A prefix owns
  itself and its subtree (`/_admin`, `/_admin/x`), never a lexical neighbour
  (`/_adminx`). Called outside `boot()`, the claim is the application's own.
- `app.routes()` — the table as registered: method, full path, and the module
  that mounted it (absent for app-level routes). Handlers are not exposed. This
  is what an operator-facing manifest and a "what is exposed" page render from;
  it is also the run-time counterpart to the static `check:routes` gate.
- Core reserves `/healthz` and `/readyz` at construction (and `/metrics` when
  metrics are on) — only when it will actually register them, so with
  `healthChecks: false` the path is yours.

`IRouter` gains `reserve()` and `list()`, and `add()` takes an optional owning
module; `IRouteEntry` is exported. Nothing outside core implements `IRouter`.
Behaviour for every existing app is unchanged unless a module was already
mounting a probe path — which was a bug being hidden, and now boots with a
message that says so.
