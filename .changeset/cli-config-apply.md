---
'@fonderie/cli': minor
---

`fonderie config|secret export · diff · apply`: manage a deployment's remote config and secrets as a reviewed file, kubectl-style. apply never deletes without `--prune`, blocks type changes without `--allow-type-change`, pins every update to the version it read (a concurrent edit gets a 409, not an overwrite) and is idempotent. Secret manifests reference values with `valueFrom: { env }` so they can be committed; `export --reveal` writes a 0600 file, diff/apply never print a value, and `--from-env-file` loads a `.env`. `fonderie config public` shows exactly what frontends receive.

The config/secret/template commands now find the admin routes whether the app serves them at `/admin/*` (the brick's own token) or `/_admin/*` (`@fonderie/admin`) — before, apps using only `@fonderie/admin` got a 404. `fonderie admin environment` reads the renamed page (`admin config` stays as an alias; it was pointing at a path that no longer exists).
