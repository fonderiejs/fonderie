---
'@fonderie/core': minor
---

`describeAdmin().checks` — a module offers reconciliation checks to the doctor

`IAdminCheck { name, run(): Promise<IAdminCheckReport> }` with
`IAdminCheckReport { ok, findings, skipped? }`. `ok` is false only for a hard
failure; findings on a passing check are advice, per the rule in
`docs/OPERATIONS.md` that keeps a healthy deployment from being permanently
red. `skipped` says why a check could not run instead of guessing.
