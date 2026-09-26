# @fonderie/geo

**IP → location** for a Fonderie app: country, region, city, time zone and
coordinates for the request you are handling. Two sources behind one shape,
`GeoLocation`; pick the one your deployment already has.

Status: **experimental** (0.x). The header path below is what runs in
production; the self-hosted table has been validated by hand and is the option
for hosts without edge geolocation.

## 1. Platform headers — zero infrastructure (Vercel, Cloudflare)

Every request that reaches a function on Vercel already carries
`x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city`,
`x-vercel-ip-timezone`, `x-vercel-ip-latitude`/`-longitude` (all plans, set by
the edge from the connecting IP). Cloudflare sends `cf-ipcountry` on every plan
and region/city/coordinates when its *visitor location headers* transform is
on. Nothing to download, load or refresh.

```ts
import { geoFromHeaders } from '@fonderie/geo';

// Trust is explicit and comes from the DEPLOYMENT, never from the request:
// anyone can send `x-vercel-ip-country: US` to a server that is not behind
// Vercel. Off-platform (local dev, Docker) this is undefined → null.
const trust = process.env.VERCEL ? 'vercel' : undefined;

const loc = geoFromHeaders(req.headers, { trust });
// → { country: 'CA', subdivision: 'QC', city: 'Montréal', continent: 'NA',
//     timeZone: 'America/Toronto', latitude, longitude, … } | null
```

Rules that keep this honest:

- **Country is decision-grade; region and city are display-grade.** IP
  geolocation below country level is unreliable on mobile carriers and VPNs.
  Gate on `country`; show `city`.
- **Unknown is unknown.** Missing or malformed headers give `null` fields (or a
  `null` location), never a guess. Do not penalise `null`.
- **Verify the platform overwrites the headers** before gating on them: send a
  request with a forged `x-vercel-ip-country` to a route that echoes it. Vercel
  documents overwriting `X-Forwarded-For` for exactly this reason.

## 2. Self-hosted table — for hosts without edge geolocation

Resolve an IPv4/IPv6 address against a Postgres table loaded from MaxMind
GeoLite2 (or Hurricane Electric) CSVs — no external API, no key shipped.

```ts
import { PostgresGeoProvider, loadMaxMindCity } from '@fonderie/geo';
import { getMigrationsPath } from '@fonderie/geo/migrations';
// 1. run getMigrationsPath()'s SQL with your store's migration runner
// 2. one-time load (full snapshot; re-run to refresh). ONE transaction over
//    millions of rows: run it from a laptop, CI or a job against a DIRECT
//    connection — never inside a serverless function or through a
//    transaction-mode pooler.
await loadMaxMindCity(store, {
  locationsPath: 'GeoLite2-City-Locations-en.csv',
  blocksV4Path:  'GeoLite2-City-Blocks-IPv4.csv',
  blocksV6Path:  'GeoLite2-City-Blocks-IPv6.csv',
});

const geo = new PostgresGeoProvider(store);
const loc = await geo.lookup(ip); // same GeoLocation shape | null
```

Blocks are stored as native `cidr`, so one table holds IPv4 **and** IPv6. A
lookup is a CIDR containment — `WHERE network >>= $ip::inet ORDER BY
masklen(network) DESC LIMIT 1` — the most-specific block that contains the
address wins, over a GiST `inet_ops` index (core Postgres, no extension).
Invalid input resolves to `null`, never an error. Budget several hundred
megabytes of table for the City dataset, and a monthly reload.

`IGeoProvider` is the swap seam: a hosted source (MaxMind API, ipinfo, …) plugs
in behind the same interface, the way `billing` swaps payment providers.

## Where it is used

As a **signal**, not a product: the reference app feeds `country` into its
`@fonderie/risk` checkout gate as an attribute (outside-market trials are
refused; paid checkout stays open). The same location is the natural source for
a "new sign-in from …" notice.

Peer-depends on `@fonderie/core` + `@fonderie/store`; imports no other brick.
