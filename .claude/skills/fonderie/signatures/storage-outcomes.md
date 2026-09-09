<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/storage — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_storage_blobs`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
bytes                    BYTEA NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

Raw SQL ships in `node_modules/@fonderie/storage/dist/migrations/sql/` — read it there if you must; never download tarballs.
