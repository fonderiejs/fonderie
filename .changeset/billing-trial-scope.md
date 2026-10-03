---
'@fonderie/billing': minor
'@fonderie/client': minor
---

**One free trial per owner, not per workspace.** With per-workspace billing every new workspace is a new subscriber, so the per-subscriber trial ledger let one person start a fresh trial in every workspace they created. New `config.trialScope: 'owner'` (default `'subscriber'`, today's behaviour): a workspace gets no trial when any workspace with the same owner has already had one. Needs the workspaces brick.

**Checkout can decline the trial.** `POST /billing/checkout` accepts `skipTrial: true` (`ICheckoutInput.skipTrial` in `@fonderie/client`) for a paid checkout from day one — the retry an app offers after refusing a trial. It declines the trial for that checkout only; it never consumes it.
