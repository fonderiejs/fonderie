import type { GeoLocation, IGeoProvider, Queryable } from './types.js';

// Cheap guard so obvious garbage never reaches the ::inet cast (which would
// throw). Not a full validator — the cast is the real gate; this just avoids a
// round-trip (and an error log) for empty / clearly-non-IP input.
const LOOKS_LIKE_IP = /^[0-9a-fA-F:.]+$/;

/**
 * The default, self-hosted provider: resolves an IP against the geo_blocks /
 * geo_names tables loaded from MaxMind/HE CSVs. The lookup is a CIDR
 * containment — the most-specific block that contains the address wins —
 * handling IPv4 and IPv6 uniformly via Postgres's native `cidr`/`inet`.
 */
export class PostgresGeoProvider implements IGeoProvider {
	readonly name = 'postgres';

	constructor(private readonly store: Queryable) {}

	async lookup(ip: string): Promise<GeoLocation | null> {
		const addr = (ip ?? '').trim();
		if (!addr || addr.length > 45 || !LOOKS_LIKE_IP.test(addr)) return null;
		try {
			const rows = await this.store.query<{
				country_iso: string | null;
				country_name: string | null;
				subdivision_iso: string | null;
				subdivision_name: string | null;
				city_name: string | null;
				continent_code: string | null;
				time_zone: string | null;
				latitude: number | null;
				longitude: number | null;
				accuracy_radius: number | null;
			}>(
				`SELECT n.country_iso, n.country_name, n.subdivision_iso, n.subdivision_name,
				        n.city_name, n.continent_code, n.time_zone,
				        b.latitude, b.longitude, b.accuracy_radius
				 FROM geo_blocks b
				 LEFT JOIN geo_names n ON n.geoname_id = b.geoname_id
				 WHERE b.network >>= $1::inet
				 ORDER BY masklen(b.network) DESC
				 LIMIT 1`,
				[addr],
			);
			const r = rows[0];
			if (!r) return null;
			return {
				country: r.country_iso ?? null,
				countryName: r.country_name ?? null,
				subdivision: r.subdivision_iso ?? null,
				subdivisionName: r.subdivision_name ?? null,
				city: r.city_name ?? null,
				continent: r.continent_code ?? null,
				timeZone: r.time_zone ?? null,
				latitude: r.latitude != null ? Number(r.latitude) : null,
				longitude: r.longitude != null ? Number(r.longitude) : null,
				accuracyRadius: r.accuracy_radius != null ? Number(r.accuracy_radius) : null,
			};
		} catch {
			// Invalid inet (bad cast) or a transient store error → unknown, not a throw.
			return null;
		}
	}
}
