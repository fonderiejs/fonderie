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
-- CONSTRAINT fonderie_wallet_ledger_subscriber_type_check CHECK (subscriber_type IN ('user', 'workspace'))
-- CONSTRAINT fonderie_wallet_ledger_type_check CHECK (type IN ('purchase', 'grant', 'usage', 'refund', 'adjustment'))
-- CONSTRAINT fonderie_wallet_ledger_amount_nonzero_check CHECK (amount <> 0)
```

Raw SQL ships in `node_modules/@fonderie/billing/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| POST | `/billing/checkout` | `requireAuth → validate(checkoutSchema) → checkout.createSession` |
| POST | `/billing/portal` | `requireAuth → checkout.createPortal` |
| GET | `/billing/subscription` | `requireAuth → subscription.get` |
| POST | `/billing/subscription/cancel` | `requireAuth → validate(cancelSubscriptionSchema) → subscription.cancel` |
| POST | `/billing/subscription/reactivate` | `requireAuth → subscription.reactivate` |
| POST | `/billing/usage` | `requireAuth → validate(recordUsageSchema) → usage.record` |
| GET | `/billing/usage/:metric` | `requireAuth → usage.get` |
| GET | `/billing/wallet` | `requireAuth → wallet.get` |
| POST | `/billing/wallet/checkout` | `requireAuth → validate(walletCheckoutSchema) → wallet.checkout` |
| POST | `/billing/wallet/grant` | `requireAdminToken(config.wallet.adminToken) → validate(grantWalletSchema) → wallet.grant` |
| GET | `/billing/wallet/transactions` | `requireAuth → wallet.transactions` |
| POST | `/billing/webhook` | `webhook.handle` |
| POST | `/billing/webhook/payment` | `paymentWebhook.handle` |
| GET | `/plans` | `plan.list` |
| POST | `/plans` | `validate(createPlanSchema) → plan.create` |
| DELETE | `/plans/:planId` | `plan.delete` |
| GET | `/plans/:planId` | `plan.get` |
| PUT | `/plans/:planId` | `validate(updatePlanSchema) → plan.update` |

## Migration statements not replayed (verify in raw SQL)

- `fonderie_plans: ALTER COLUMN monthly_amount TYPE BIGINT`
- `fonderie_plans: ALTER COLUMN yearly_amount TYPE BIGINT`
