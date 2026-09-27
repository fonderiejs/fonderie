---
'@fonderie/auth': minor
'@fonderie/client': minor
---

`IRequestLocation.accuracyRadius` (kilometres) — how approximate a stored
location is. Resolvers backed by MaxMind or an IP-intelligence API report it;
it was being dropped on write. Sanitized to a positive whole number of at
most 20,000 km. `@fonderie/geo`'s `PostgresGeoProvider` already returns it;
`geoFromHeaders` returns null (the platforms send no radius).
