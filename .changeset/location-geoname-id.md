---
'@fonderie/auth': minor
'@fonderie/client': minor
'@fonderie/geo': minor
---

Locations carry `geonameId` — MaxMind/GeoNames' stable, language-neutral key
for the place resolved. Stored names are a snapshot in one language; the id
lets any reader see a login's place in their own language later, and lets an
app map places onto its own regions (markets, provinces, pricing zones).
`PostgresGeoProvider` returns it from the City block; `geoFromHeaders` returns
`null` (platforms send names, not a key). Auth sanitizes it to a positive
32-bit integer, accepting node-pg's BIGINT-as-string.
