// Public types for @fonderie/geo.

/** A resolved IP location. Any field may be null — MaxMind has blocks with a
 * country but no city, etc. */
export interface GeoLocation {
	country: string | null; // ISO-3166-1 alpha-2
	countryName: string | null;
	subdivision: string | null; // ISO-3166-2 (state/region)
	subdivisionName: string | null;
	city: string | null;
	continent: string | null; // continent code (NA, EU, …)
	timeZone: string | null;
	latitude: number | null;
	longitude: number | null;
	accuracyRadius: number | null;
}

/** The swap seam: the default resolves against the self-hosted Postgres table,
 * but a consumer can plug a hosted provider (MaxMind API, ipinfo, …) behind
 * the same interface — same pattern as IBillingProvider / IStorageProvider. */
export interface IGeoProvider {
	name: string;
	/** Resolve an IPv4/IPv6 address to a location, or null if unknown/invalid. */
	lookup(ip: string): Promise<GeoLocation | null>;
}

/** Store adapter surface the Postgres provider needs (accepts the adapter or a
 * transaction handle). */
export interface Queryable {
	query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}
