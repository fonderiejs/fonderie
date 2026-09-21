---
'@fonderie/core': minor
---

`describeAdmin()` — a module offers its operator routes; the app collects them

`IFonderieModule.describeAdmin?(): IAdminDescription` returns `{ routes }`,
each `{ method, path, handlers }` with `path` relative to the admin prefix
and `handlers` unguarded — the admin brick supplies the guard when it mounts
them. `app.adminDescriptions()` collects every module's description, sorted
by name, without installing anything; descriptions must therefore come from
constructor state.

This is how `@fonderie/admin` composes one surface without owning any
brick's logic, and how a brick keeps working standalone when admin is not
installed. `docs/ADMIN-BRICK-DESIGN.md` phase 3.
