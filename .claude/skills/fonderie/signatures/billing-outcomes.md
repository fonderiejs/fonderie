<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/billing — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_billing_notifications`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
policy_key               TEXT NOT NULL
notification             TEXT NOT NULL
window_key               TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- CONSTRAINT fonderie_billing_notifications_unique UNIQUE (subscriber_type, subscriber_id, policy_key, notification, window_key)
```

### `fonderie_credit_packs`

```sql
id                       TEXT PRIMARY KEY
name                     TEXT NOT NULL
currency                 TEXT NOT NULL DEFAULT 'USD'
credits                  BIGINT NOT NULL
price_amount             BIGINT NOT NULL
price_id                 TEXT
active                   BOOLEAN NOT NULL DEFAULT true
metadata                 JSONB NOT NULL DEFAULT '{}'
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_plans`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
name                     TEXT NOT NULL UNIQUE
seats                    INT
trial_days               INT NOT NULL DEFAULT 0
monthly_amount           INT
monthly_price_id         TEXT
yearly_amount            INT
yearly_price_id          TEXT
active                   BOOLEAN NOT NULL DEFAULT true
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
description              TEXT
tier                     INT NOT NULL DEFAULT 0
features                 JSONB NOT NULL DEFAULT '[]'
metadata                 JSONB NOT NULL DEFAULT '{}'
wallet                   JSONB
```

### `fonderie_subscription_trials`

```sql
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
consumed_at              TIMESTAMPTZ NOT NULL DEFAULT now()
-- PRIMARY KEY (subscriber_type, subscriber_id)
-- CONSTRAINT fonderie_subscription_trials_subscriber_type_check CHECK (subscriber_type IN ('user', 'workspace'))
```

### `fonderie_subscriptions`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
plan                     TEXT NOT NULL
interval                 TEXT NOT NULL DEFAULT 'month'
status                   TEXT NOT NULL DEFAULT 'incomplete'
provider_customer_id     TEXT
provider_subscription_id TEXT
current_period_start     TIMESTAMPTZ
current_period_end       TIMESTAMPTZ
cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false
trial_ends_at            TIMESTAMPTZ
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
CONSTRAINT               fonderie_subscriptions_subscriber_unique UNIQUE (subscriber_type, subscriber_id)
provider_event_at        TIMESTAMPTZ
```

### `fonderie_usage_records`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
metric                   TEXT NOT NULL
quantity                 INT NOT NULL DEFAULT 1
recorded_at              TIMESTAMPTZ NOT NULL DEFAULT now()
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
CONSTRAINT               fonderie_usage_records_subscriber_type_check CHECK (subscriber_type IN ('user', 'workspace'))
```

### `fonderie_wallet_balances`

```sql
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
currency                 TEXT NOT NULL DEFAULT 'USD'
amount                   BIGINT NOT NULL DEFAULT 0
version                  BIGINT NOT NULL DEFAULT 1
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
granted_amount           BIGINT NOT NULL DEFAULT 0
granted_period           TEXT
granted_expires_at       TIMESTAMPTZ
spend_purchased          BOOLEAN NOT NULL DEFAULT true
-- CONSTRAINT fonderie_wallet_balances_subscriber_type_check CHECK (subscriber_type IN ('user', 'workspace'))
-- PRIMARY KEY (subscriber_type, subscriber_id, currency)
```

### `fonderie_wallet_customers`

```sql
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
provider                 TEXT NOT NULL
provider_customer_id     TEXT NOT NULL
auto_recharge_disabled   BOOLEAN NOT NULL DEFAULT false
consecutive_failures     INT NOT NULL DEFAULT 0
last_recharge_at         TIMESTAMPTZ
pending_recharge_key     TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
payment_method_id        TEXT
pending_recharge_key_at  TIMESTAMPTZ
-- CONSTRAINT fonderie_wallet_customers_subscriber_type_check CHECK (subscriber_type IN ('user', 'workspace'))
-- PRIMARY KEY (subscriber_type, subscriber_id, provider)
```

### `fonderie_wallet_grants`

```sql
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
currency                 TEXT NOT NULL
period                   TEXT NOT NULL
amount                   BIGINT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- CONSTRAINT fonderie_wallet_grants_subscriber_type_check CHECK (subscriber_type IN ('user', 'workspace'))
-- PRIMARY KEY (subscriber_type, subscriber_id, currency, period)
```

### `fonderie_wallet_ledger`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
subscriber_type          TEXT NOT NULL
subscriber_id            UUID NOT NULL
currency                 TEXT NOT NULL DEFAULT 'USD'
type                     TEXT NOT NULL
amount                   BIGINT NOT NULL
balance_after            BIGINT NOT NULL
description              TEXT
idempotency_key          TEXT NOT NULL UNIQUE
metadata                 JSONB NOT NULL DEFAULT '{}'
provider_tx_id           TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
CONSTRAINT               fonderie_wallet_ledger_type_check CHECK (type IN ('purchase', 'grant', 'usage', 'refund', 'adjustment', 'expiry'))
-- CONSTRAINT fonderie_wallet_ledger_subscriber_type_check CHECK (subscriber_type IN ('user', 'workspace'))
-- CONSTRAINT fonderie_wallet_ledger_type_check CHECK (type IN ('purchase', 'grant', 'usage', 'refund', 'adjustment'))
-- CONSTRAINT fonderie_wallet_ledger_amount_nonzero_check CHECK (amount <> 0)
```

Raw SQL ships in `node_modules/@fonderie/billing/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/_admin/catalog` | `async () => { const stored = (await getDBPlans(store)).map(toPlanDTO); return setApiResponse(HTTP.OK, 'CATALOG', 'Plans', { configured: jsonSafe(getPlans(config)), stored, }); }` |
| GET | `/_admin/subscriptions/:type/:id` | `async (ctx) => { const sub = subscriberOf(ctx); if (!sub) return BAD_SUBSCRIBER(); const row = await getSubscription(sub.type, sub.id, store); return row ? setApiResponse(HTTP.OK, 'SUBSCRIPTION', 'Subscription', row) : setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No subscription for this subscriber'); }` |
| GET | `/_admin/wallet/:type/:id` | `async (ctx) => { const sub = subscriberOf(ctx); if (!sub) return BAD_SUBSCRIBER(); const q = new URL(ctx.request.url).searchParams.get('currency'); const currency = q && /^[A-Za-z]{3,20}$/.test(q) ? normalizeCurrency(q) : defaultCurrency(); const b = await getWalletBalance( { subscriberType: sub.type, subscriberId: sub.id, currency }, store, ); const wallet = toWalletDTO(b.balance, currency, config.wallet?.precision ?? 2, { granted: b.granted, purchased: b.purchased, spendPurchased: b.spendPurchased, grantedExpiresAt: b.grantedExpiresAt, }); return setApiResponse(HTTP.OK, 'WALLET', 'Wallet balance', { ...wallet, version: b.version, updatedAt: b.updatedAt, }); }` |
| GET | `/_admin/wallet/:type/:id/ledger` | `async (ctx) => { const sub = subscriberOf(ctx); if (!sub) return BAD_SUBSCRIBER(); const params = new URL(ctx.request.url).searchParams; const q = params.get('currency'); const currency = q && /^[A-Za-z]{3,20}$/.test(q) ? normalizeCurrency(q) : defaultCurrency(); const rawLimit = params.get('limit'); const limit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : 50; if (Number.isNaN(limit) || limit < 1 || limit > 100) return setApiResponse( HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'limit must be an integer between 1 and 100', ); const rawCursor = params.get('cursor'); const cursor = rawCursor !== null ? decodeLedgerCursor(rawCursor) : null; if (rawCursor !== null && cursor === null) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Malformed cursor'); const page = await getWalletLedger( { subscriberType: sub.type, subscriberId: sub.id, currency, limit, ...(cursor ? { cursor } : {}), }, store, ); return setApiResponse(HTTP.OK, 'WALLET_LEDGER', 'Wallet ledger', { currency, entries: page.entries.map(toWalletTransactionDTO), nextCursor: page.nextCursor, }); }` |
| POST | `/billing/checkout` | `requireAuth → manager → validate(checkoutSchema) → checkout.createSession` |
| GET | `/billing/invoices` | `requireAuth → account.listInvoices` |
| DELETE | `/billing/payment-method` | `requireAuth → manager → account.removePaymentMethod` |
| GET | `/billing/payment-method` | `requireAuth → account.getPaymentMethod` |
| PUT | `/billing/payment-method` | `requireAuth → manager → validate(savePaymentMethodSchema) → account.savePaymentMethod` |
| POST | `/billing/payment-method/setup` | `requireAuth → manager → account.setupPaymentMethod` |
| POST | `/billing/portal` | `requireAuth → manager → checkout.createPortal` |
| GET | `/billing/subscription` | `requireAuth → subscription.get` |
| POST | `/billing/subscription/cancel` | `requireAuth → manager → validate(cancelSubscriptionSchema) → subscription.cancel` |
| POST | `/billing/subscription/reactivate` | `requireAuth → manager → subscription.reactivate` |
| POST | `/billing/usage` | `requireAuth → validate(recordUsageSchema) → usage.record` |
| GET | `/billing/usage/:metric` | `requireAuth → usage.get` |
| GET | `/billing/wallet` | `requireAuth → wallet.get` |
| POST | `/billing/wallet/checkout` | `requireAuth → manager → validate(walletCheckoutSchema) → wallet.checkout` |
| POST | `/billing/wallet/grant` | `requireAdminToken(walletAdminToken) → validate(grantWalletSchema) → wallet.grant` |
| POST | `/billing/wallet/preferences` | `requireAuth → manager → validate(walletPreferencesSchema) → wallet.setPreferences` |
| POST | `/billing/wallet/purchase` | `requireAuth → manager → validate(walletPurchaseSchema) → wallet.purchase` |
| GET | `/billing/wallet/transactions` | `requireAuth → wallet.transactions` |
| POST | `/billing/webhook` | `webhook.handle` |
| POST | `/billing/webhook/payment` | `paymentWebhook.handle` |
| GET | `/plans` | `plan.list` |
| POST | `/plans` | `requireAdminToken(planAdminToken) → validate(createPlanSchema) → plan.create` |
| DELETE | `/plans/:planId` | `requireAdminToken(planAdminToken) → plan.delete` |
| GET | `/plans/:planId` | `plan.get` |
| PUT | `/plans/:planId` | `requireAdminToken(planAdminToken) → validate(updatePlanSchema) → plan.update` |

## Migration statements not replayed (verify in raw SQL)

- `fonderie_plans: ALTER COLUMN monthly_amount TYPE BIGINT`
- `fonderie_plans: ALTER COLUMN yearly_amount TYPE BIGINT`
- `EXCEPTION WHEN duplicate_object THEN NULL`
- `END $$`
