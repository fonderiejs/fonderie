<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/risk — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `risk_events`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
assessment_id            UUID NOT NULL
subject                  TEXT NOT NULL
actor_id                 UUID
signal_kind              TEXT NOT NULL
value_hash               TEXT NOT NULL
outcome                  TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'allowed', 'challenged', 'blocked'))
score                    INTEGER
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
expires_at               TIMESTAMPTZ NOT NULL
```

Raw SQL ships in `node_modules/@fonderie/risk/dist/migrations/sql/` — read it there if you must; never download tarballs.
