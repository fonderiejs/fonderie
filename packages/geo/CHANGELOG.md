# @fonderie/geo

## 0.5.2

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0

## 0.5.1

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0

## 0.5.0

### Minor Changes

- cb2ea60: MaxMind GeoLite2 **ASN** support. `loadMaxMindAsn(store, { blocksV4Path,
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
- cb2ea60: `PostgresGeoProvider` now returns `postalCode`. MaxMind's City blocks carry a
  postal code per block, but the ingest skipped that column and the table had
  nowhere to store it, so the self-hosted path always answered `null` while
  `geoFromHeaders` returned one. Migration `002_geo_postal_code.sql` adds the
  column (run your migrations, then reload with `loadMaxMindCity()` to fill it);
  the ingest reads and bounds it.
- cb2ea60: Locations carry `geonameId` — MaxMind/GeoNames' stable, language-neutral key
  for the place resolved. Stored names are a snapshot in one language; the id
  lets any reader see a login's place in their own language later, and lets an
  app map places onto its own regions (markets, provinces, pricing zones).
  `PostgresGeoProvider` returns it from the City block; `geoFromHeaders` returns
  `null` (platforms send names, not a key). Auth sanitizes it to a positive
  32-bit integer, accepting node-pg's BIGINT-as-string.

## 0.4.0

### Minor Changes

- 3446009: Auth events can say where they came from. `IAuthConfig.location` is an
  optional resolver `({ ip, headers }) => IRequestLocation | null`, called at
  most once per request. Its result is stored on every login-attempt row, on a
  new `registration` row written at sign-up, and on each new session (nullable
  `location` JSONB columns — migrations 018 and 019, run your migrations), and
  returned as `location` on login-history events and active sessions. Absent
  resolver ⇒ `location: null`, behaviour unchanged apart from the new
  `registration` rows in login history.
  
  Registration is recorded because with verification not enforced the account
  is live from that request: it is the first record of where the user came from.
  
  Auth imports no geo code: on Vercel/Cloudflare pass
  `({ headers }) => geoFromHeaders(headers, { trust })` from `@fonderie/geo`; a
  self-hosted table or an IP-intelligence API fits the same contract and may add
  ISP/ASN/proxy/hosting. Output is treated as untrusted: type-checked and
  bounded, coordinates rounded to ~1 km, re-sanitized on read;
  a resolver that throws or exceeds 500 ms leaves the row without a location.
  
  Client: `IRequestLocationDTO`, `location` on `ILoginEventDTO` and
  `ISessionDTO`, and `describeLocation(loc, countryName?)` ("Mountain View, CA, US");
  the auth hook packages re-export the type. The admin console shows location
  next to the IP for live sessions and recent sign-ins, with a proxy/VPN or
  hosting flag when known.
  
  Postal / ZIP code is kept when the resolver knows it (`postalCode`), and
  `@fonderie/geo`'s `geoFromHeaders` now reads it from Vercel's
  `x-vercel-ip-postal-code` and Cloudflare's `cf-postal-code`. It is approximate
  for an IP, so `describeLocation` leaves it out of the one-line display.

## 0.3.0

### Minor Changes

- 1278281: `geoFromHeaders(headers, { trust })` — resolve the requester's location from
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

## 0.2.13

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

## 0.2.12

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 0.2.11

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0

## 0.2.10

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 0.2.9

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 0.2.8

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0

## 0.2.7

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0

## 0.2.6

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0

## 0.2.5

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0

## 0.2.4

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0

## 0.2.3

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 0.2.2

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 0.2.1

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 0.2.0

### Minor Changes

- f87e659: New brick: `@fonderie/geo` — self-hosted IP → location. Provider-abstracted
  (`IGeoProvider`); the default `PostgresGeoProvider` resolves against a Postgres
  table of MaxMind/Hurricane-Electric CIDR blocks using native `cidr`/`inet` + a
  GiST `inet_ops` index — IPv4 and IPv6, most-specific block wins, no external API
  or key. Ships the MaxMind GeoLite2 City CSV ingest (`loadMaxMindCity` + parsers)
  and the `geo_blocks`/`geo_names` migration. A signal source for `@fonderie/risk`
  and day-one request geo for any Fonderie app. Experimental (0.x).

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0
