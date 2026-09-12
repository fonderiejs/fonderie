<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/geo — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## Database tables (after all migrations)

### `geo_blocks`

```sql
network                  CIDR NOT NULL
geoname_id               BIGINT
latitude                 DOUBLE PRECISION
longitude                DOUBLE PRECISION
accuracy_radius          INTEGER
-- INDEX idx_geo_blocks_geoname (geoname_id)
-- UNIQUE INDEX uq_geo_blocks_network (network)
```

### `geo_names`

```sql
geoname_id               BIGINT PRIMARY KEY
continent_code           TEXT
country_iso              TEXT
country_name             TEXT
subdivision_iso          TEXT
subdivision_name         TEXT
city_name                TEXT
time_zone                TEXT
```

Raw SQL ships in `node_modules/@fonderie/geo/dist/migrations/sql/` — read it there if you must; never download tarballs.
