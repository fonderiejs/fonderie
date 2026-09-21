---
'@fonderie/admin': minor
---

`GET /_admin/doctor` and the attention page at `GET /_admin`

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
