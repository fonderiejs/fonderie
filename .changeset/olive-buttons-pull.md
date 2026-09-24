---
'@fonderie/admin': patch
'@fonderie/react-config-admin': patch
'@fonderie/vue-config-admin': patch
---

The admin UI no longer offers a Config page for a brick that is not installed

Clicking "Config & secrets" crashed the dashboard with
`Uncaught TypeError: a.map is not a function`, alongside a 404 on
`/_admin/secrets`.

The 404 was the harmless symptom. The crash was a **silent shape collision**:
the served UI decided whether to show the page by probing the manifest for
`/_admin/config` — a path `@fonderie/admin` registers ITSELF, as the
declared-vs-held report. So the probe was true on every deployment. The shell
built a `ConfigAdminClient`, `listConfig()` fetched `/_admin/config`, got
**200** carrying admin's report OBJECT where it expected an ARRAY of config
entries, and the screen died on `.map`.

A 200 with the wrong shape is worse than a 404: nothing reports it.

- The probe is now `/secrets`, which only `@fonderie/config` serves.
- `useConfigEntries` / `useSecrets` (React and Vue) reject a non-array result
  instead of handing it to a component typed for a list, and say what is
  likely wrong: "is @fonderie/config mounted at this prefix?"

A test in `@fonderie/admin` pins the invariant both ways — that this module
owns `/_admin/config` (so probing it for another brick is a false positive)
and does NOT own `/_admin/secrets` (so the new probe stays sound).

**Separately, and NOT fixed here:** `@fonderie/config` describes `/config`,
which `@fonderie/admin` already owns, so registering both modules fails boot
with "cannot describe GET /_admin/config". That needs one of the two paths to
move and is a breaking change for whichever loses.
