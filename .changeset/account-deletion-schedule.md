---
'@fonderie/auth': minor
---

The account-deletion scheduler (docs/ACCOUNT-DELETION-DESIGN.md, Phase 3):
`runAccountDeletionSchedule(store, config, bus)` — call it from a daily cron
(or `startAccountDeletionSchedule`) instead of `purgeSoftDeletedUsers`.

- **Reminder** — once, `accountDeletion.reminderDaysBefore` (default 7) days
  before the deletion date, on the channel the person chose, only if they have
  not tried to sign in since asking. New `account-deletion-reminder` email in
  en / fr / es / zh-Hans / zh-Hant (route it to `['email', 'sms']`).
- **Purge, erasers first** — each due account, one at a time under a row lock
  (`SKIP LOCKED`: parallel schedulers share the work), runs auth's eraser and
  every `accountDeletion.erasers` entry IN-PROCESS before its row goes. One
  failure keeps the account archived and the next run retries — nothing is
  half-erased. Auth's own eraser removes sign-in attempts recorded against the
  address alone and phone codes keyed by the number.
- **Erasure receipt** — `fonderie_account_erasures` (migration 023): when it was
  requested, reminded and erased, and each brick's outcome — no personal data;
  email / phone only as HMAC hashes with the app's secret (`erasureHash`).
- `fonderie.user.purged` is announced after each erasure, as before.
