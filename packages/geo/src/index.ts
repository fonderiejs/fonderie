// @fonderie/geo — IP → location for the request you are handling.
//
// Two sources, one shape (GeoLocation):
// - geoFromHeaders(): the platform's edge geolocation headers (Vercel,
//   Cloudflare) — zero infrastructure; trust is explicit and comes from the
//   deployment, never from the request. What runs in production.
// - PostgresGeoProvider: a self-hosted table of MaxMind/HE CIDR blocks (native
//   inet/GiST — IPv4 + IPv6, no external API) for hosts without edge geo. Run
//   getMigrationsPath()'s SQL, then load with loadMaxMindCity().
// IGeoProvider is the swap seam for a hosted source. A signal source for
// @fonderie/risk and a day-one "where is this request from" for any app.
export { geoFromHeaders } from './headers.js';
export type { GeoFromHeadersOptions, GeoHeaderSource, HeadersLike } from './headers.js';
export { PostgresGeoProvider } from './provider.js';
export {
	loadMaxMindCity,
	loadMaxMindAsn,
	ingestAsnBlocks,
	parseAsnCsv,
	asnRowFromLine,
	ingestNames,
	ingestBlocks,
	parseBlocksCsv,
	parseLocationsCsv,
	parseCsvLine,
	blockRowFromLine,
	nameRowFromLine,
} from './ingest.js';
export type { AsnRow, BlockRow, NameRow, TxStore } from './ingest.js';
export type { GeoLocation, IGeoProvider, Queryable } from './types.js';
