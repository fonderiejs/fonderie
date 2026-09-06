---
'@fonderie/billing': minor
---

Declare `stripe` as an **optional `peerDependency`** (`>=17`) instead of an `optionalDependencies`. This matches Fonderie's provider-injection model — the consumer instantiates `StripeProvider`, so the consumer owns the Stripe SDK: one `stripe` copy at the version the app chooses, and consumers on a non-Stripe `IBillingProvider` no longer pull `stripe` in transitively.

`StripeProvider` already loads `stripe` via a lazy dynamic `import()` (pinned to Stripe API `2024-11-20.acacia`), so nothing in `@fonderie/billing` needs it at build time. If you use `StripeProvider`, add `stripe` to your app (`npm install stripe`) — the provider already throws a clear "stripe is required: npm install stripe" if it's missing. Apps that already depend on `stripe` directly need no change.
