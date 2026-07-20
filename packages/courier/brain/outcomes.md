<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/courier — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_courier_templates`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
type                     TEXT NOT NULL
locale                   TEXT
subject                  TEXT
html                     TEXT
text                     TEXT NOT NULL
active                   BOOLEAN NOT NULL DEFAULT true
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- UNIQUE (type, locale)
```

### `fonderie_message_log`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
message_type             TEXT NOT NULL
channel                  TEXT NOT NULL
recipient                TEXT NOT NULL
locale                   TEXT
status                   TEXT NOT NULL DEFAULT 'pending'
error                    TEXT
attempts                 INT NOT NULL DEFAULT 0
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
sent_at                  TIMESTAMPTZ
provider                 TEXT
provider_message_id      TEXT
opened_at                TIMESTAMPTZ
clicked_at               TIMESTAMPTZ
bounced_at               TIMESTAMPTZ
bounce_reason            TEXT
-- INDEX idx_fml_created (created_at DESC)
```

Raw SQL ships in `node_modules/@fonderie/courier/dist/migrations/sql/` — read it there if you must; never download tarballs.

## Migration statements not replayed (verify in raw SQL)

- `ELSE`
- `END IF`
- `END $$`
