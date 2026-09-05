---
'@fonderie/billing': minor
---

BillingInterval: one source of truth, exhaustive branching, honest Stripe fallback

Every interval-typed surface now derives from `BillingInterval` instead of
repeating the inline `'month' | 'year'` union: `ISubscription.interval`,
`INormalizedSubscription.interval`, `IResolvedPrice.interval`, and
`upsertSubscription`'s input. A new `BILLING_INTERVALS` tuple is the single
value carrier — it drives the type, the `checkoutSchema` zod enum (previously
a duplicated literal list), and a new exported `isBillingInterval` guard; the
existing `BILLING_INTERVAL` object stays as the dot-access companion, pinned
to the union with `satisfies`.

The checkout controller's binary ternary became an exhaustive `switch` with a
`never` default, and `StripeProvider`'s interval normalization no longer
silently collapses everything non-year to month: unsupported Stripe intervals
('day', 'week') keep the historical month fallback but now log a warning, so
a weekly price can't masquerade as monthly unnoticed.

Net effect: adding a billing interval becomes a checklist of compiler errors
starting at `BILLING_INTERVALS`, rather than a silent no-op. Additive —
`BillingInterval` still resolves to `'month' | 'year'` and no wire format
changes.
