<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/events — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_event_consumers`

```sql
event_id                 UUID NOT NULL REFERENCES fonderie_events(id) ON DELETE CASCADE
consumer                 TEXT NOT NULL
status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead'))
attempts                 INT NOT NULL DEFAULT 0
error                    TEXT
processed_at             TIMESTAMPTZ
-- PRIMARY KEY (event_id, consumer)
```

### `fonderie_events`

```sql
id                       UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()
type                     TEXT NOT NULL
payload                  JSONB NOT NULL DEFAULT '{}'
meta                     JSONB NOT NULL DEFAULT '{}'
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

Raw SQL ships in `node_modules/@fonderie/events/dist/migrations/sql/` — read it there if you must; never download tarballs.
