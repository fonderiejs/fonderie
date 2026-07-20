<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/customers — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `fonderie_addresses`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
country_iso              TEXT NOT NULL
subdivision1_iso         TEXT
subdivision2_iso         TEXT
zip_postal_code          TEXT NOT NULL
line1                    TEXT
line2                    TEXT
unit                     TEXT
```

### `fonderie_customer_addresses`

```sql
addr_id                  UUID NOT NULL REFERENCES fonderie_addresses(id) ON DELETE CASCADE
customer_id              UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE
label                    TEXT NOT NULL DEFAULT 'service'
is_primary               BOOLEAN NOT NULL DEFAULT false
label_id                 UUID REFERENCES fonderie_customer_labels(id)
CONSTRAINT               fonderie_customer_addresses_label_id_fkey FOREIGN KEY (label_id) REFERENCES fonderie_customer_labels(id) ON DELETE SET NULL
-- PRIMARY KEY (addr_id, customer_id)
```

### `fonderie_customer_emails`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id              UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE
email                    TEXT NOT NULL
label                    TEXT NOT NULL DEFAULT 'work'
is_primary               BOOLEAN NOT NULL DEFAULT false
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
label_id                 UUID REFERENCES fonderie_customer_labels(id)
CONSTRAINT               fonderie_customer_emails_label_id_fkey FOREIGN KEY (label_id) REFERENCES fonderie_customer_labels(id) ON DELETE SET NULL
```

### `fonderie_customer_labels`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
type                     fonderie_customer_label_type NOT NULL
value                    TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- CONSTRAINT uq_fcl_type_value UNIQUE (type, value)
```

### `fonderie_customer_notes`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id              UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE
author_id                UUID
body                     TEXT NOT NULL
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `fonderie_customer_phones`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id              UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE
phone                    TEXT NOT NULL
label                    TEXT NOT NULL DEFAULT 'mobile'
is_primary               BOOLEAN NOT NULL DEFAULT false
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
label_id                 UUID REFERENCES fonderie_customer_labels(id)
CONSTRAINT               fonderie_customer_phones_label_id_fkey FOREIGN KEY (label_id) REFERENCES fonderie_customer_labels(id) ON DELETE SET NULL
```

### `fonderie_customer_relationships`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id             UUID NOT NULL
customer_id              UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE
related_id               UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE
relationship             TEXT NOT NULL
is_primary               BOOLEAN NOT NULL DEFAULT false
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
-- UNIQUE (customer_id, related_id)
```

### `fonderie_customer_sequences`

```sql
workspace_id             UUID NOT NULL
prefix                   TEXT NOT NULL
next_val                 BIGINT NOT NULL DEFAULT 1
-- PRIMARY KEY (workspace_id, prefix)
```

### `fonderie_customer_tags`

```sql
customer_id              UUID NOT NULL REFERENCES fonderie_customers(id) ON DELETE CASCADE
tag                      TEXT NOT NULL
-- PRIMARY KEY (customer_id, tag)
```

### `fonderie_customers`

```sql
id                       UUID PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id             UUID NOT NULL
type                     TEXT NOT NULL DEFAULT 'individual'
first_name               TEXT
last_name                TEXT
company_name             TEXT
avatar_url               TEXT
locale                   TEXT NOT NULL DEFAULT 'en-US'
reference_code           TEXT
is_blacklisted           BOOLEAN NOT NULL DEFAULT false
created_by               UUID
created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
sex                      TEXT NOT NULL DEFAULT 'UNKNOWN'
blacklist_reason         TEXT
```

Raw SQL ships in `node_modules/@fonderie/customers/dist/migrations/sql/` — read it there if you must; never download tarballs.

## Seeded rows (behavioral contract)

```sql
INSERT INTO fonderie_customer_labels (type, value) VALUES ('email', 'work'), ('email', 'personal'), ('email', 'billing'), ('phone', 'mobile'), ('phone', 'office'), ('phone', 'home'), ('phone', 'fax'), ('address', 'service'), ('address', 'billing'), ('address', 'other') ON CONFLICT (type, value) DO NOTHING;
INSERT INTO fonderie_customer_labels (type, value) SELECT DISTINCT 'email'::fonderie_customer_label_type, label FROM fonderie_customer_emails WHERE label IS NOT NULL ON CONFLICT (type, value) DO NOTHING;
INSERT INTO fonderie_customer_labels (type, value) SELECT DISTINCT 'phone'::fonderie_customer_label_type, label FROM fonderie_customer_phones WHERE label IS NOT NULL ON CONFLICT (type, value) DO NOTHING;
INSERT INTO fonderie_customer_labels (type, value) SELECT DISTINCT 'address'::fonderie_customer_label_type, label FROM fonderie_customer_addresses WHERE label IS NOT NULL ON CONFLICT (type, value) DO NOTHING;
```

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/customers` | `requireAuth → wsCtx → customer.list` |
| POST | `/customers` | `requireAuth → wsCtx → validate(createCustomerSchema) → customer.create` |
| DELETE | `/customers/:customerId` | `requireAuth → wsCtx → customer.delete` |
| GET | `/customers/:customerId` | `requireAuth → wsCtx → customer.get` |
| PUT | `/customers/:customerId` | `requireAuth → wsCtx → validate(updateCustomerSchema) → customer.update` |
| GET | `/customers/:customerId/addresses` | `requireAuth → wsCtx → address.list` |
| POST | `/customers/:customerId/addresses` | `requireAuth → wsCtx → validate(addAddressSchema) → address.add` |
| DELETE | `/customers/:customerId/addresses/:addrId` | `requireAuth → wsCtx → address.remove` |
| PATCH | `/customers/:customerId/addresses/:addrId` | `requireAuth → wsCtx → validate(updateAddressSchema) → address.update` |
| PUT | `/customers/:customerId/addresses/:addrId/primary` | `requireAuth → wsCtx → address.setPrimary` |
| POST | `/customers/:customerId/blacklist` | `requireAuth → wsCtx → validate(blacklistSchema) → customer.blacklist` |
| GET | `/customers/:customerId/emails` | `requireAuth → wsCtx → email.list` |
| POST | `/customers/:customerId/emails` | `requireAuth → wsCtx → validate(addEmailSchema) → email.add` |
| DELETE | `/customers/:customerId/emails/:emailId` | `requireAuth → wsCtx → email.remove` |
| PATCH | `/customers/:customerId/emails/:emailId` | `requireAuth → wsCtx → validate(updateEmailSchema) → email.update` |
| PUT | `/customers/:customerId/emails/:emailId/primary` | `requireAuth → wsCtx → email.setPrimary` |
| GET | `/customers/:customerId/notes` | `requireAuth → wsCtx → note.list` |
| POST | `/customers/:customerId/notes` | `requireAuth → wsCtx → validate(noteSchema) → note.create` |
| DELETE | `/customers/:customerId/notes/:noteId` | `requireAuth → wsCtx → note.delete` |
| PUT | `/customers/:customerId/notes/:noteId` | `requireAuth → wsCtx → validate(noteSchema) → note.update` |
| GET | `/customers/:customerId/phones` | `requireAuth → wsCtx → phone.list` |
| POST | `/customers/:customerId/phones` | `requireAuth → wsCtx → validate(addPhoneSchema) → phone.add` |
| DELETE | `/customers/:customerId/phones/:phoneId` | `requireAuth → wsCtx → phone.remove` |
| PATCH | `/customers/:customerId/phones/:phoneId` | `requireAuth → wsCtx → validate(updatePhoneSchema) → phone.update` |
| PUT | `/customers/:customerId/phones/:phoneId/primary` | `requireAuth → wsCtx → phone.setPrimary` |
| GET | `/customers/:customerId/relationships` | `requireAuth → wsCtx → relationship.list` |
| POST | `/customers/:customerId/relationships` | `requireAuth → wsCtx → validate(addRelationshipSchema) → relationship.add` |
| DELETE | `/customers/:customerId/relationships/:relatedId` | `requireAuth → wsCtx → relationship.remove` |
| PUT | `/customers/:customerId/relationships/:relatedId/primary` | `requireAuth → wsCtx → relationship.setPrimary` |
| GET | `/customers/:customerId/tags` | `requireAuth → wsCtx → tag.list` |
| POST | `/customers/:customerId/tags` | `requireAuth → wsCtx → validate(addTagSchema) → tag.add` |
| DELETE | `/customers/:customerId/tags/:tag` | `requireAuth → wsCtx → tag.remove` |
| POST | `/customers/:customerId/unblacklist` | `requireAuth → wsCtx → customer.unblacklist` |
| GET | `/customers/labels` | `requireAuth → wsCtx → label.list` |
| DELETE | `/customers/labels/:labelId` | `requireAuth → wsCtx → label.remove` |

## Migration statements not replayed (verify in raw SQL)

- `END IF`
- `END $$`
- `CREATE TYPE fonderie_customer_label_type AS ENUM ('email', 'phone', 'address')`
