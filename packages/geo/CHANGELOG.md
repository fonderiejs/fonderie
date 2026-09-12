# @fonderie/geo

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
