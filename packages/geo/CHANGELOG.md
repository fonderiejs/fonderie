# @fonderie/geo

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
