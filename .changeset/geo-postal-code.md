---
'@fonderie/geo': minor
---

`PostgresGeoProvider` now returns `postalCode`. MaxMind's City blocks carry a
postal code per block, but the ingest skipped that column and the table had
nowhere to store it, so the self-hosted path always answered `null` while
`geoFromHeaders` returned one. Migration `002_geo_postal_code.sql` adds the
column (run your migrations, then reload with `loadMaxMindCity()` to fill it);
the ingest reads and bounds it.
