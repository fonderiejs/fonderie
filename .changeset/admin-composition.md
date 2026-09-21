---
'@fonderie/admin': minor
---

Mount every brick's described admin routes under the prefix

`AdminModule` now reads `app.adminDescriptions()` and mounts each described
route at `/_admin` + path, behind its own token — so config, courier and
billing's admin surfaces appear at `/_admin/config`, `/_admin/secrets`,
`/_admin/templates`, `/_admin/plans` and `/_admin/wallet/grant` with one
token, whatever each brick's own `adminToken` is set to. Two modules
describing the same route fail boot, naming both.

The manifest gains `describesAdmin` per module, so a brick that offers
nothing is distinguishable from one that has not implemented the contract.
