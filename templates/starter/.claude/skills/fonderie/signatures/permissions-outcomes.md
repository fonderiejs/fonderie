<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/permissions — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_role_permissions`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
role_id                  UUID NOT NULL
workspace_id             UUID
permission_key           TEXT NOT NULL
can_create               BOOLEAN NOT NULL DEFAULT false
can_read                 BOOLEAN NOT NULL DEFAULT false
can_update               BOOLEAN NOT NULL DEFAULT false
can_delete               BOOLEAN NOT NULL DEFAULT false
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- UNIQUE (role_id, permission_key)
-- INDEX idx_frp_permission_key (permission_key)
```

Raw SQL ships in `node_modules/@fonderie/permissions/dist/migrations/sql/` — read it there if you must; never download tarballs.
