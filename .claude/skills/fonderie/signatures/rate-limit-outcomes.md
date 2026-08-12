<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/rate-limit — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_rate_limits`

```sql
key                      TEXT NOT NULL PRIMARY KEY
tokens                   DOUBLE PRECISION NOT NULL
last_refill_ms           DOUBLE PRECISION NOT NULL
granted                  BOOLEAN NOT NULL DEFAULT TRUE
```

Raw SQL ships in `node_modules/@fonderie/rate-limit/dist/migrations/sql/` — read it there if you must; never download tarballs.
