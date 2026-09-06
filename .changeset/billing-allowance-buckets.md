---
'@fonderie/billing': minor
---

Phase 5a: allowance vs purchased credit buckets (founder-selectable hybrid monetization)

The wallet now distinguishes a non-stackable subscription **allowance** from a stacking **purchased** balance, so a plan can include monthly credits *and* sell top-ups without the two commingling. `amount` keeps its exact meaning (total spendable); a new `granted_amount` (+ `granted_period`, `granted_expires_at`) tracks the allowance, and `purchased = amount − granted`. Migration `010`; new `expiry` ledger type.

- **Allowance-first debit** — a debit draws the free allowance before purchased credits (one atomic, floor-checked statement).
- **Allowance expires, purchased persists** — unspent granted credits expire at period end per a new per-plan `IBillingPlanWallet.grantRollover` (`'none'` default = use-it-or-lose-it, `'full'`, or `{ cap }`); the expiry is settled before any spend so stale allowance is never spendable. Purchased credits carry over indefinitely.
- **Refund confined to purchased** — a refund/chargeback clawback (`reverseWallet`) touches the total/purchased only and can never consume the granted allowance.
- **Spend-purchased toggle** — a new per-subscriber `spend_purchased` flag (default true); when false, a debit is refused (402) once the allowance is exhausted, so a paid balance is never drained unless the user opts in.
- **Backward compatible** — existing single-balance wallets classify wholly as purchased (nothing already held ever expires); pure wallet-only and subscription-only behavior is unchanged. `getWalletBalance` and the wallet DTO gain optional `granted`/`purchased`/`spendPurchased`/`grantedExpiresAt`. `checkReadiness()` flags an allowance configured without a wallet and a negative rollover cap. New exports `settleAllowance`, `startOfNextPeriod`.

Additive/opt-in throughout. Verified against real PostgreSQL (allowance-first, expiry none/full/cap, toggle hard-stop, refund-purchased-only, overdraft-eats-purchased, legacy-balance-is-purchased) and adversarially reviewed. The per-subscriber toggle's HTTP setter + client/hooks follow in 5b.
