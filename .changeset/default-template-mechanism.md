---
'@fonderie/core': minor
'@fonderie/courier': minor
---

Default email templates: mechanism + resolver fallback chain (P0 — behavior-neutral).

Groundwork so every module that emits customer notifications can ship a **default template** that renders out of the box, before any app override — closing the gap where a missing template silently delivered a raw JSON dump to the customer.

- **`@fonderie/core`** adds the `IDefaultTemplate` type (`{ subject?, text, html? }`) — the shape a module's built-in copy takes. It lives in core (like `ICourierMessage`) so modules declare defaults without importing `@fonderie/courier`.
- **`@fonderie/courier`** adds:
  - `DefaultTemplates` (a merged lookup over the module-shipped maps) and `renderFragment` (factored from the DB-row render path, so a default renders byte-identically to a DB row — same `{{var}}` interpolation, same layout composition).
  - A **fallback chain** in both `FSTemplateResolver` and `DBTemplateResolver`: **app override (DB row / FS file) → module default → last-resort JSON dump**. A per-key app override always wins; the JSON dump is now reached only for a type neither the app nor any module provides.
  - `ICourierConfig.templates.defaults?: DefaultTemplateMap | DefaultTemplateMap[]` — the app hands courier each module's `DEFAULT_TEMPLATES` (aggregated like `getMigrationsPath()`); `createTemplateResolver` wires them into both resolvers. No courier→module import — only the core *type* is shared, so no dependency cycle.

**Behavior-neutral:** with no `templates.defaults` configured, `DefaultTemplates` is empty and both resolvers fall through to the JSON dump exactly as before. No module ships default content in this change — that lands per-module (auth, workspaces, billing) on top of this mechanism, each map constrained by `satisfies Record<ItsMessageKey, IDefaultTemplate>` so a missing key is a compile error.
