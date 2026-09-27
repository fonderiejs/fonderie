---
'@fonderie/geo': minor
---

MaxMind GeoLite2 **ASN** support. `loadMaxMindAsn(store, { blocksV4Path,
blocksV6Path })` loads the free ASN database into a new `geo_asn_blocks` table
(migration `003_geo_asn.sql` — run your migrations), and
`PostgresGeoProvider.lookup()` now returns `asn` ("AS15169") and `org`
("Google LLC") alongside the City fields — one query, two containment lookups.
`GeoLocation` gains `asn` and `org` (named to match `@fonderie/auth`'s
location); `geoFromHeaders` sets both to `null`, since platforms send no
network data.

An address found only in the ASN data returns its network facts; one found in
neither returns `null`. If migration 003 has not run yet, lookups fall back to
City-only and log one warning rather than failing — code routinely goes live
ahead of migrations. Verified against a real Postgres 16: migrations apply
twice idempotently, the most-specific block wins, IPv6 casts.
