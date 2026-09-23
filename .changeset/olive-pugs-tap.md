---
'@fonderie/auth': patch
'@fonderie/billing': patch
'@fonderie/courier': patch
'@fonderie/events': patch
'@fonderie/media': patch
'@fonderie/workspaces': patch
'@fonderie/webhooks': patch
'@fonderie/audit': patch
'@fonderie/customers': patch
'@fonderie/config': patch
'@fonderie/permissions': patch
'@fonderie/logger': patch
'@fonderie/admin': patch
---

Every module reports its version, so the Modules page can answer

`IFonderieModule.version` is optional, and `@fonderie/admin` was the only
module that set it. The operator's Modules page exists to answer "what is
actually deployed here" and answered it for one module out of six — every
other row read "not reported", which is honest and useless.

`tsup.base` now bakes `FONDERIE_PKG_VERSION` into every build (tsup runs with
cwd set to the package being built, so it reads the right `package.json`
without each config passing its own), and each module reports it. Admin drops
its bespoke `FONDERIE_ADMIN_VERSION` for the shared one.

A test walks `packages/*/src/module.ts` and fails when a class implementing
`IFonderieModule` does not report a version — it caught `@fonderie/logger`,
which was missing from the first pass.
