# @fonderie/geo

Self-hosted **IP → location**. Resolve an IPv4/IPv6 address to a country /
region / city / lat-lng against a Postgres table loaded from MaxMind GeoLite2
(or Hurricane Electric) CSVs — **no external API, no key shipped**.

Status: **experimental** (0.x).

> Provider-abstracted via `IGeoProvider` — the default `PostgresGeoProvider` is
> self-hosted; a consumer who prefers a hosted source (MaxMind API, ipinfo, …)
> plugs one in behind the same interface, the way `billing` swaps payment
> providers. You're never locked into the self-hosted map.

## Why it's a brick

It's a **signal source**, not a product: `@fonderie/risk` consumes it (geo /
impossible-travel), and any Fonderie app gets a day-one "where did this request
come from" — access-log geo, suspicious-login hints — for free. In-process,
against your own database.

## Use it

```ts
import { PostgresGeoProvider, loadMaxMindCity } from '@fonderie/geo';
import { getMigrationsPath } from '@fonderie/geo/migrations';
// 1. run getMigrationsPath()'s SQL with your store's migration runner
// 2. one-time load (full snapshot; re-run to refresh):
await loadMaxMindCity(store, {
  locationsPath: 'GeoLite2-City-Locations-en.csv',
  blocksV4Path:  'GeoLite2-City-Blocks-IPv4.csv',
  blocksV6Path:  'GeoLite2-City-Blocks-IPv6.csv',
});

const geo = new PostgresGeoProvider(store);
const loc = await geo.lookup(ip); // → { country, subdivision, city, latitude, longitude, … } | null
```

## How the lookup works

Blocks are stored as native `cidr`, so one table holds IPv4 **and** IPv6. A
lookup is a CIDR containment — `WHERE network >>= $ip::inet ORDER BY
masklen(network) DESC LIMIT 1` — the most-specific block that contains the
address wins. A GiST `inet_ops` index (core Postgres, no extension) makes it
fast. Invalid input resolves to `null`, never an error.

## Data

The CSVs are MaxMind's (GeoLite2 City, free with an account) or a compatible
source — you download and host them; nothing proprietary ships in this package.
`loadMaxMindCity` truncates and reloads (the dataset is a full snapshot).

Peer-depends on `@fonderie/core` + `@fonderie/store`; imports no other brick.
