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

Raw SQL ships in `node_modules/@fonderie/billing/dist/migrations/sql/` — read it there if you must; never download tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| POST | `/billing/checkout` | `requireAuth → validate(checkoutSchema) → checkout.createSession` |
| POST | `/billing/portal` | `requireAuth → checkout.createPortal` |
| GET | `/billing/subscription` | `requireAuth → subscription.get` |
| POST | `/billing/usage` | `requireAuth → validate(recordUsageSchema) → usage.record` |
| GET | `/billing/usage/:metric` | `requireAuth → usage.get` |
| POST | `/billing/webhook` | `webhook.handle` |
| GET | `/plans` | `plan.list` |
| POST | `/plans` | `validate(createPlanSchema) → plan.create` |
| DELETE | `/plans/:planId` | `plan.delete` |
| GET | `/plans/:planId` | `plan.get` |
| PUT | `/plans/:planId` | `validate(updatePlanSchema) → plan.update` |
