<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/config — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_config`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
key                      TEXT NOT NULL
value                    TEXT NOT NULL
environment              TEXT NOT NULL DEFAULT 'all'
description              TEXT
active                   BOOLEAN NOT NULL DEFAULT true
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
version                  INT NOT NULL DEFAULT 1
updated_by               TEXT
-- UNIQUE (key, environment)
```

### `fonderie_config_revisions`

```sql
key                      TEXT NOT NULL
environment              TEXT NOT NULL DEFAULT 'all'
value                    TEXT NOT NULL
version                  INT NOT NULL
actor                    TEXT
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- PRIMARY KEY (key, environment, version)
```

Raw SQL ships in `node_modules/@fonderie/config/dist/migrations/sql/` — read it there if you must; never download tarballs.
