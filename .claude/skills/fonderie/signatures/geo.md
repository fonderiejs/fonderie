<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/geo — signatures

## @fonderie/geo

Subpath exports: `@fonderie/geo/migrations`

```ts
new PostgresGeoProvider(store: Queryable): PostgresGeoProvider
  .name: "postgres"
  .lookup(ip: string): Promise<GeoLocation | null>

function loadMaxMindCity(store: TxStore, files: { locationsPath: string; blocksV4Path?: string; blocksV6Path?: string; }): Promise<{ names: number; blocks: number; }>

function ingestNames(store: Queryable, rows: NameRow[]): Promise<number>

function ingestBlocks(store: Queryable, rows: BlockRow[]): Promise<number>

function parseBlocksCsv(text: string): BlockRow[]

function parseLocationsCsv(text: string): NameRow[]

function parseCsvLine(line: string): string[]

function blockRowFromLine(line: string): BlockRow | null

function nameRowFromLine(line: string): NameRow | null

interface BlockRow {
    network: string;
    geonameId: number | null;
    latitude: number | null;
    longitude: number | null;
    accuracyRadius: number | null;
}

interface NameRow {
    geonameId: number;
    continentCode: string | null;
    countryIso: string | null;
    countryName: string | null;
    subdivisionIso: string | null;
    subdivisionName: string | null;
    cityName: string | null;
    timeZone: string | null;
}

interface TxStore extends Queryable {
    transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

interface GeoLocation {
    country: string | null;
    countryName: string | null;
    subdivision: string | null;
    subdivisionName: string | null;
    city: string | null;
    continent: string | null;
    timeZone: string | null;
    latitude: number | null;
    longitude: number | null;
    accuracyRadius: number | null;
}

interface IGeoProvider {
    name: string;
    lookup(ip: string): Promise<GeoLocation | null>;
}

interface Queryable {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}
```
