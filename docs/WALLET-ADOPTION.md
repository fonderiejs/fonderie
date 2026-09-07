# Adopting the `@fonderie/billing` wallet from a legacy balance system

> **STATUS: REFERENCE RECIPE (2026-09-06).** Distilled from the first real
> migration — LeadEasyGen moved a hand-rolled credits system onto the
> `@fonderie/billing` stored-value wallet (phases A→F). This generalises the
> **backfill** step (seeding the wallet from an existing balance) into a
> reusable pattern, since every legacy schema differs but the invariants don't.
> Working document: extend it as later migrations surface edge cases; don't
> fork it (same convention as `HOOK-GAP-AUDIT.md` / `DTO-GAP-AUDIT.md`).

## When you need this

You already run a SaaS with a **home-grown balance** (a `credits` column, a
purchase ledger, "tokens", store credit, prepaid minutes…) and you're adopting
`@fonderie/billing`'s wallet as the new source of truth. Registering
`BillingModule` creates the wallet tables, but they start **empty** — existing
users would see a zero balance. A one-time **backfill** seeds each subscriber's
current balance into the wallet so cutover is invisible to them.

This recipe is only the data-seeding step. The full migration shape (wire
billing additively → backfill → cut compute over → cut routes over → cut the
client over → retire the legacy schema) is the LeadEasyGen worked example; see
the phase spine at the end.

## The wallet model you're seeding

Three tables (`@fonderie/billing` migrations create them — run those first):

| Table | Holds |
| --- | --- |
| `fonderie_wallet_balances` | The cached balance per `(subscriber_type, subscriber_id, currency)` — split into `granted_amount` (allowance, expirable) and the remainder (`amount` total; purchased = `amount − granted_amount`). |
| `fonderie_wallet_ledger` | Append-only entries (`purchase`/`grant`/`usage`/`refund`/`adjustment`/`expiry`), each with `amount`, `balance_after`, a unique `idempotency_key`, and JSON `metadata`. |
| `fonderie_wallet_grants` | One row per `(subscriber, currency, period)` marking a periodic allowance already issued — the idempotency guard that stops a period from being granted twice. |

Two ideas make the backfill correct:

1. **Classify the migrated balance as PURCHASED, not granted.** A wallet balance
   is `granted` (this period's free allowance, which *expires* at period end per
   the plan's rollover policy) plus `purchased` (paid/top-up credit, which
   *persists*). Seed the entire legacy balance as **purchased** (`granted_amount = 0`)
   so nobody's existing balance silently expires at the next period boundary.
2. **Don't double-grant the current period.** If the legacy system already gave
   a user this month's free allowance, that amount is *inside* the balance you
   just migrated. Seed a `fonderie_wallet_grants` marker for the current period
   so `withBilling`'s lazy `ensurePeriodicGrant` sees it as done and doesn't add
   a second allowance on the user's first post-cutover request.

## The recipe

Write it as a standalone, idempotent, dry-runnable script (`npm run backfill:wallet`).
The SQL below is the generalized shape; replace `legacy_users.balance` /
`legacy_grants` with your schema. `$1` is the wallet currency.

**0 — Preflight.** Assert the wallet tables exist (BillingModule migrations have
run) and refuse otherwise. Point `DATABASE_URL` at a **throwaway copy** first.

**1 — Opening balance → one ledger row + one balance row per subscriber, as PURCHASED.**

```sql
-- Ledger: an 'adjustment' opening entry. balance_after == amount because this
-- is the first (only) opening entry. idempotency_key is per subscriber → re-runs
-- are no-ops.
INSERT INTO fonderie_wallet_ledger
    (subscriber_type, subscriber_id, currency, type, amount, balance_after,
     description, idempotency_key, metadata)
SELECT 'user', u.id, $1, 'adjustment', u.balance, u.balance,
    'Opening balance migrated from legacy system',
    'legacy-migration:opening-balance:' || u.id,
    jsonb_build_object('source', 'legacy-migration', 'bucket', 'purchased')
FROM legacy_users u
WHERE u.balance <> 0
ON CONFLICT (idempotency_key) DO NOTHING;

-- Balance cache: granted_amount = 0 → the whole balance is purchased (persists).
INSERT INTO fonderie_wallet_balances
    (subscriber_type, subscriber_id, currency, amount, granted_amount)
SELECT 'user', u.id, $1, u.balance, 0
FROM legacy_users u
WHERE u.balance <> 0
ON CONFLICT (subscriber_type, subscriber_id, currency) DO NOTHING;
```

**2 — Prevent a double grant this period.** Seed the current-period marker for
anyone who already received it in the legacy system this period. Billing's period
key is `YYYY-MM` (UTC) for monthly grants — matching `currentGrantPeriod('month')`.
Only the *current* period matters; billing never re-grants past periods.

```sql
INSERT INTO fonderie_wallet_grants
    (subscriber_type, subscriber_id, currency, period, amount)
SELECT 'user', g.user_id, $1,
    to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM'), g.amount
FROM legacy_grants g
WHERE to_char(g.period, 'YYYY-MM') = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM')
ON CONFLICT (subscriber_type, subscriber_id, currency, period) DO NOTHING;
```

**3 — Reconcile inside the transaction, and abort on mismatch.** The whole
backfill runs in one transaction; before committing, assert credits were
conserved:

```
SUM(fonderie_wallet_balances.amount WHERE currency = $1)  ==  SUM(legacy balance)
```

If they differ, `throw` (rolls back) with a non-zero exit — never commit an
unreconciled money migration.

**4 — Dry run.** Do everything inside the transaction, print the reconciliation
numbers, then `throw` a sentinel to **roll back**. Re-run without `--dry-run`
only once the numbers are right.

## Denomination

The wallet is currency-typed at a precision. Two common shapes:

- **Credit counts** (LeadEasyGen): a non-ISO currency (e.g. `'CRD'`) at
  `precision: 0`, so balances are whole counts and `formatWalletAmount` renders
  a bare number (`"50"`), not `"$50.00"`. Credit *packs* can still be *charged*
  in real money — billing credits the wallet in wallet units regardless.
- **Stored money**: an ISO currency (`'USD'`) at `precision: 2`; balances are
  minor units (cents).

Seed the balance in the wallet's own unit (convert legacy → wallet units in
step 1 if they differ).

## Safety checklist

- [ ] Run against a **throwaway copy** of production first; verify the numbers.
- [ ] Run for real with legacy writes **frozen** (deploy the cutover that stops
      the legacy system writing balances, then backfill) so no write races the seed.
- [ ] Idempotent (`ON CONFLICT DO NOTHING` + per-subscriber `idempotency_key`) —
      a re-run is a no-op, not a double-credit.
- [ ] Reconciles in-transaction; `--dry-run` rolls back.
- [ ] Negative legacy balances: decide explicitly (carry as-is, or floor to 0).
- [ ] The script is a one-time tool — retire it once cutover is verified (it
      reads legacy tables that later get dropped).

## Worked example — LeadEasyGen (phases A→F)

The reference implementation lives in `examples/leadeasygen/microservices/api`
(its own repo). The backfill was `src/billing/backfill.ts` (retired in phase F;
recoverable from git history). The migration spine, reusable for any adoption:

- **A** — register `BillingModule` additively (creates wallet tables; nothing
  reads the wallet yet; legacy system still runs).
- **B** — this backfill (dry-run → reconcile → real run at cutover).
- **C** — cut compute over: grant via `withBilling`, debit via `debitWallet`
  (idempotency key + overdraft floor), fast-fail via `requireWalletBalance`.
- **D** — cut routes over: pack checkout + payment webhook onto billing's
  (`/billing/wallet/checkout`, `/billing/webhook/payment`); delete hand-rolled provider code.
- **E** — cut the client over: `@fonderie/client` + `@fonderie/react-billing`
  (or `vue-billing`).
- **F** — retire the legacy schema (drop the tables/columns), gated on a
  zero-observation grep that nothing references them.
