// @fonderie/geo — self-hosted IP → location.
//
// The default PostgresGeoProvider resolves against a table of MaxMind/HE CIDR
// blocks (native inet/GiST — IPv4 + IPv6, no external API). IGeoProvider is the
// swap seam for a hosted source later. A signal source for @fonderie/risk and a
// day-one "where is this request from" for any Fonderie app.
//
// Run getMigrationsPath()'s SQL with your store's migration runner, then load
// data with loadMaxMindCity() (or the parse*/ingest* pieces).
export { PostgresGeoProvider } from './provider.js';
export {
	loadMaxMindCity,
	ingestNames,
	ingestBlocks,
	parseBlocksCsv,
	parseLocationsCsv,
	parseCsvLine,
} from './ingest.js';
export type { BlockRow, NameRow } from './ingest.js';
export type { GeoLocation, IGeoProvider, Queryable } from './types.js';
