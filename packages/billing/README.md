# @fonderie/billing

SaaS billing as a brick: a config-driven plan catalogue, Stripe
subscriptions, feature gates, and usage limits — so "can this workspace do
that?" is one function call.

## Install

```sh
npm install @fonderie/billing
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { BillingModule } from '@fonderie/billing';

const app = await new FonderieApp(defineConfig({}))
  .register(new BillingModule())
  .boot();
```

Gate routes and features:

```ts
import { requirePlan, requireFeature, hasFeature, getPlanLimit } from '@fonderie/billing';
```

`StripeProvider` handles checkout and webhook events; usage counters run
on `MemoryCounterBackend` or `DBCounterBackend`.

## Stored-value wallet (opt-in)

Setting `wallet` on the billing config turns on a ledger-backed credit
wallet: subscribers hold a balance (`bigint`, smallest currency unit), buy
config-defined credit packs through one-time provider checkout, and plans
price metered actions in credits.

```ts
new BillingModule(store, {
  provider: new StripeProvider(secretKey),
  successUrl, cancelUrl, webhookSecret,
  wallet: {
    currency: 'USD',
    webhookSecret: process.env.STRIPE_PAYMENT_WEBHOOK_SECRET, // separate endpoint
    creditPacks: [{ id: 'small', name: 'Small pack', credits: 5000n, priceAmount: 499n }],
  },
  plans: [{
    name: 'payg',
    wallet: {
      grantAmount: 50n, // auto-granted lazily, once per period
      rates: { 'sms:send': { cost: 75n, unit: 'msg' } },
    },
  }],
});
```

Every mutation goes through the append-only ledger with an idempotency
key — the balance table is a cache, debits are atomic (`FOR UPDATE` plus a
conditional-update floor), and webhook replays are no-ops. In routes:
`requireWalletBalance('sms:send')` gates on affordability; inside the unit
of work, `debitWalletForMetric(ctx, 'sms:send', { idempotencyKey: taskId }, store)`
charges the plan rate exactly once. Wallet amounts cross HTTP as digit
strings (`IWalletDTO`).

## Payment methods (in-app card management)

Let subscribers add and manage a card **without leaving your site** — no
redirect to a hosted portal. Four routes, all `requireAuth` and scoped to the
caller's own provider customer (created lazily on first use):

| Route | Does |
|---|---|
| `POST /billing/payment-method/setup` | Starts card entry — returns a provider **SetupIntent** `{ clientSecret }` for an embedded card element (Stripe Payment Element) to confirm. |
| `PUT /billing/payment-method` | After the element confirms, records `{ paymentMethodId }` as the default and returns the saved card `{ paymentMethod }`. |
| `GET /billing/payment-method` | The card on file (`brand` / `last4` / `expMonth` / `expYear`), or `null`. Server-side, the provider-normalized card (`INormalizedCard`) additionally carries the stable Stripe card `fingerprint` for app-level fraud/trial-abuse composition — it is deliberately never exposed on this route. |
| `DELETE /billing/payment-method` | Detaches the card at the provider and clears the record. |

The flow is three steps and stays on-page:

1. `POST …/payment-method/setup` → hand the `clientSecret` to a Stripe Payment Element.
2. The element confirms the SetupIntent client-side (`confirmSetup({ redirect: 'if_required' })`) — no off-site bounce.
3. `PUT …/payment-method` with the resulting `paymentMethodId` → it becomes the default, ready to charge off-session.

`StripeProvider` implements this through optional `IBillingProvider` methods —
`createSetupIntent` / `setDefaultPaymentMethod` / `detachPaymentMethod`; a
provider that omits them answers `501` and the UI reads that as "in-app entry
unavailable" (fall back to the hosted portal). Every write is ownership-checked
— the payment method must belong to the caller's customer.

The SetupIntent offers the payment method types you configure on the provider,
defaulting to card only:

```ts
import { StripeProvider, SUPPORTED_PAYMENT_OPTIONS } from '@fonderie/billing';

// default — card only: displayable ("Visa •••• 4242"), off-session-chargeable, on-page
new StripeProvider(secretKey, webhookSecret);
// equivalent explicit form, and how to broaden it:
new StripeProvider(secretKey, webhookSecret, {
  setupPaymentMethodTypes: [SUPPORTED_PAYMENT_OPTIONS.CARD],
});
```

Card is the default because it is the only method that yields a payment method
with a `card` object — one that shows as a card on file and reads back. Wallet
methods like Stripe `LINK` are off-session-chargeable but produce a `type:'link'`
PM with no card details, so they can't be displayed as a stored card. The brick
doesn't hard-code this — it's your policy.

Wire the UI with the framework hooks — `usePaymentMethod`,
`useSetupPaymentMethod`, `useSavePaymentMethod`, `useRemovePaymentMethod` in
[`@fonderie/react-billing`](https://github.com/fonderiejs/sdk/tree/main/packages/react-billing)
/ [`@fonderie/vue-billing`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-billing)
/ `@fonderie/react-native-billing` — or drop in `SubscriptionScreen` from the
`*-billing-screens` packages, which shows and removes the card and delegates
add/update to your own Payment Element.

## Buying credits in-app (charge the saved card)

Once a card is on file, a subscriber can buy a credit pack **without leaving the
site** — no redirect to hosted checkout. `POST /billing/wallet/purchase`
(`{ packId, idempotencyKey }`) charges the saved card and credits the wallet:

| Outcome (`result.status`) | Meaning | What the client does |
|---|---|---|
| `credited` | charged + wallet credited | show success, refresh the balance — no redirect |
| `checkout_required` | no saved card, or the card needs 3-D Secure | fall back to `POST /billing/wallet/checkout` (hosted) |
| `declined` | card declined | surface the error / offer another card |
| `processing` | indeterminate (network/timeout) | retry with the **same** `idempotencyKey` — never a new payment |

`StripeProvider` bills through a real **invoice** (`chargeViaInvoice`: draft →
line item → finalize → pay off-session), so the buyer gets an invoice — number +
downloadable PDF + hosted page — alongside the card receipt, and it appears in
`GET /billing/invoices`. A provider without `chargeViaInvoice` falls back to
`chargeOffSession` (a bare charge — receipt only). Either way the wallet credit is
idempotent on the resulting PaymentIntent (a double-submit or retry credits once),
and an `invoice.paid` webhook heals an indeterminate charge, keyed on the same
PaymentIntent so it still credits exactly once.

Set `wallet.blockPacksWhileSubscribed: true` to refuse pack purchases for an
active/trialing subscriber on a paid plan (server-enforced on **both** the hosted
and in-app paths) — their plan already includes its credits.

Wire the UI with `usePurchasePack` in
[`@fonderie/react-billing`](https://github.com/fonderiejs/sdk/tree/main/packages/react-billing)
/ [`@fonderie/vue-billing`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-billing)
/ `@fonderie/react-native-billing` — it charges the card, retries `processing`
in place with one key, and resolves to the outcome so you fall back to hosted
checkout on `checkout_required`.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** what the caller pays for. Plans, subscriptions, feature gates, and
usage limits — the commercial rules the other bricks consult before acting.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
