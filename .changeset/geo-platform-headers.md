---
'@fonderie/geo': minor
'@fonderie/cli': patch
---

`geoFromHeaders(headers, { trust })` — resolve the requester's location from
the platform's edge geolocation headers (Vercel: country, region, city, time
zone, coordinates on every plan; Cloudflare: country always, the rest with its
visitor-location transform) with zero infrastructure. Same `GeoLocation` shape
as `PostgresGeoProvider.lookup()`.

Trust is explicit and must come from the deployment (`process.env.VERCEL ?
'vercel' : undefined`), never from the request: anyone can send
`x-vercel-ip-country: US` to a server that is not behind Vercel. With no trusted
source the function returns `null`. Malformed values become `null` fields;
Cloudflare's `XX`/`T1` read as unknown.

This is the path the reference app wires (country → a `@fonderie/risk`
attribute on the checkout gate). The self-hosted Postgres table remains the
option for hosts without edge geolocation and its README now says so — and
warns that the MaxMind load is one transaction over millions of rows that must
run against a direct connection, off the request path.
