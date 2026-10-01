---
'@fonderie/core': minor
'@fonderie/sse': patch
---

**`fonderie.*` event types are reserved for the bricks, and the event catalog is validated when every app boots.**

- **Reserved prefix:** a module not named `@fonderie/*` that declares a `fonderie.*` type in `describeEvents()` is refused. The message suggests the app's own prefix (`app.job.assigned`).
  - Without this, an app event under the bricks' prefix collided the day a brick shipped the same name, and the app stopped booting after an upgrade.
  - The prefix is exported as `RESERVED_EVENT_PREFIX`.
- **Validated at every boot:** `boot()` now validates the merged event catalog before any module installs. Before, only realtime delivery read it, so a duplicate type or an invalid entry went unnoticed in apps without `@fonderie/sse`.

**`@fonderie/sse`:** an anonymous caller now gets the same `401` for a private topic and a nonexistent one. Before, a private topic answered `401` and an unknown one `400`, so anyone could list a deployment's private event names by probing. Signed-in callers still get `400` with the list of valid topics.
