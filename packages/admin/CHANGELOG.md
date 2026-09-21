# @fonderie/admin

## 0.3.0

### Minor Changes

- 2363ea6: `GET /_admin/doctor` and the attention page at `GET /_admin`
  
  The five reconciliation checks from `docs/OPERATIONS.md` had one home: a
  cron route in an example app, reporting through `console.error`. Now every
  brick that describes checks has them run at `/_admin/doctor` — on demand,
  each under `checkTimeoutMs` (default 10 s), a throw turned into a finding,
  never a 500. Two modules offering one check name fail boot, naming both.
  `AdminModule({ checks })` takes the ones no module owns, such as pending
  migrations.
  
  `GET /_admin` is what needs the operator today: readiness problems as
  reported, failed checks as errors, findings on passing checks as advice.
  `ok: true, items: []` is green.

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 0.2.0

### Minor Changes

- e687c4e: Mount every brick's described admin routes under the prefix
  
  `AdminModule` now reads `app.adminDescriptions()` and mounts each described
  route at `/_admin` + path, behind its own token — so config, courier and
  billing's admin surfaces appear at `/_admin/config`, `/_admin/secrets`,
  `/_admin/templates`, `/_admin/plans` and `/_admin/wallet/grant` with one
  token, whatever each brick's own `adminToken` is set to. Two modules
  describing the same route fail boot, naming both.
  
  The manifest gains `describesAdmin` per module, so a brick that offers
  nothing is distinguishable from one that has not implemented the contract.

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 0.1.0

### Minor Changes

- 981ee15: New brick: `@fonderie/admin` — the operator's surface
  
  The model that assembled the app knows what is installed, wired and
  configured. The human who deployed it does not, unless they are back in a
  development session and can ask. The answer already existed in core
  (`securityReport()`, `app.routes()`); it had no address.
  
  `AdminModule({ adminToken, path = '/_admin' })` owns one reserved prefix —
  no other module can mount under it, a collision fails boot — behind one
  admin token, fail-closed by absence and strength-checked at boot like every
  other brick's admin surface.
  
  `GET /_admin/manifest`: every registered module with its version (when it
  reports one) and its readiness problems, the aggregate readiness, and the
  full route table with the module that mounted each route. Readiness details
  are shown here in production, unlike the public `/readyz`, because the
  operator is the audience.
  
  Phase 2 of `docs/ADMIN-BRICK-DESIGN.md`. Bricks describing their own admin
  routes and checks (composition, doctor) come next.

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0
