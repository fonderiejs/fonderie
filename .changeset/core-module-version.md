---
'@fonderie/core': minor
---

Modules can report their version; `securityReport()` carries it

`IFonderieModule.version?: string` — optional, for the deployment manifest.
`ISecurityReport.modules` lists each registered module with the version it
reports; `registeredModules` is unchanged. A SOC 2 evidence snapshot that
names versions is a better snapshot.

Inject it at build time (tsup `env`) rather than reading `package.json` at
run time: a brick's `exports` map does not expose it, and serverless tracers
prune what they cannot follow.
