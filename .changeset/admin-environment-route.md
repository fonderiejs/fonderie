---
'@fonderie/admin': major
'@fonderie/client': major
'@fonderie/react-admin': major
'@fonderie/vue-admin': major
'@fonderie/react-admin-screens': major
'@fonderie/vue-admin-screens': major
---

**Breaking:** the admin console's config report is now the *environment* report.

`@fonderie/admin` registered `GET /_admin/config` for a payload that has never
been configuration: readiness problems per module, and which **declared env
vars are set**. That is a deployment report.

Holding the name had two costs.

`@fonderie/config` describes `GET /_admin/config` for real config entries, so
registering both modules **failed boot outright**, in either order:
`[fonderie] @fonderie/config cannot describe GET /_admin/config`. The config
brick could not be used alongside the admin console at all — its "Config &
secrets" page was unreachable by construction.

The misnomer also caused a production crash. The served UI probed `/config` to
decide whether the config brick was mounted; because admin owned that path the
probe was true on every deployment, so the shell built a `ConfigAdminClient`
whose `listConfig()` received admin's report *object* where it expected an
*array*, and the page died on `entries.map(...)`.

| before | after |
|---|---|
| `GET /_admin/config` | `GET /_admin/environment` |
| `AdminClient.config()` | `AdminClient.environment()` |
| `useAdminConfig` | `useAdminEnvironment` |
| `IUseAdminConfigReturn` | `IUseAdminEnvironmentReturn` |
| `ConfigScreen` / `IConfigScreenProps` | `EnvironmentScreen` / `IEnvironmentScreenProps` |
| `IAdminConfigReport` | `IAdminEnvironmentReport` |
| `AdminPage` member `'config'` | `'environment'` |
| nav label "Configuration" | "Environment" |

No deprecation alias is possible: freeing the path *is* the fix, so serving it
under both names would preserve the collision.

`@fonderie/config` and its screens packages are unchanged — they keep
`/_admin/config` and `/_admin/secrets`, which is the point.

Migration is a rename. If you called `AdminClient.config()`, call
`.environment()`; if you imported `useAdminConfig` or `ConfigScreen`, import the
`Environment` names. Nothing in this repo's examples used any of them.
