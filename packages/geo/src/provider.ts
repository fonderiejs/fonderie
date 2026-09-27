import type { GeoLocation, IGeoProvider, Queryable } from './types.js';

// Cheap guard so obvious garbage never reaches the ::inet cast (which would
// throw). Not a full validator — the cast is the real gate; this just avoids a
// round-trip for empty / clearly-non-IP input.
const LOOKS_LIKE_IP = /^[0-9a-fA-F:.]+$/;
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is an IPv4 address wearing a v6 hat. Node's
// socket.remoteAddress returns this on dual-stack servers, and it casts to an
// AF_INET6 inet that never matches IPv4 `cidr` blocks — so without this the
// lookup silently returns null for the bulk of real traffic. Mirrors
// @fonderie/core's resolveClientIp, which strips the same prefix upstream.
const V4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
// Postgres 22P02 = invalid_text_representation — i.e. a bad ::inet cast. That
// is an "unknown/invalid IP" (expected → quiet null); anything else is a real
// fault we must NOT hide behind null.
const PG_INVALID_TEXT = '22P02';
// 42P01 = undefined_table: the ASN table's migration (003) has not run yet.
// City lookups must keep working through that window (code routinely goes live
// ahead of migrations), so the provider falls back to a City-only query and
// says so once.
const PG_UNDEFINED_TABLE = '42P01';
let warnedNoAsnTable = false;

interface LookupRow {
	geoname_id: number | string | null;
	country_iso: string | null;
	country_name: string | null;
	subdivision_iso: string | null;
	subdivision_name: string | null;
	city_name: string | null;
	continent_code: string | null;
	time_zone: string | null;
	postal_code: string | null;
	latitude: number | null;
	longitude: number | null;
	accuracy_radius: number | null;
	asn?: number | string | null;
	organization?: string | null;
}

// Most-specific City block for the address.
const CITY_LATERAL = `SELECT b.geoname_id, n.country_iso, n.country_name, n.subdivision_iso, n.subdivision_name,
		        n.city_name, n.continent_code, n.time_zone,
		        b.postal_code, b.latitude, b.longitude, b.accuracy_radius
		 FROM geo_blocks b
		 LEFT JOIN geo_names n ON n.geoname_id = b.geoname_id
		 WHERE b.network >>= q.ip
		 ORDER BY masklen(b.network) DESC
		 LIMIT 1`;

// One round trip: the City block and the ASN block are independent
// containment lookups on the same address. Always returns exactly one row.
const LOOKUP_WITH_ASN = `SELECT c.*, a.asn, a.organization
	 FROM (SELECT $1::inet AS ip) q
	 LEFT JOIN LATERAL (${CITY_LATERAL}) c ON true
	 LEFT JOIN LATERAL (
		 SELECT asn, organization FROM geo_asn_blocks
		 WHERE network >>= q.ip ORDER BY masklen(network) DESC LIMIT 1
	 ) a ON true`;

const LOOKUP_CITY_ONLY = `SELECT c.* FROM (SELECT $1::inet AS ip) q LEFT JOIN LATERAL (${CITY_LATERAL}) c ON true`;

function normalizeIp(ip: string): string {
	const m = V4_MAPPED.exec(ip);
	return m ? (m[1] as string) : ip;
}

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
		const raw = (ip ?? '').trim();
		if (!raw || raw.length > 45 || !LOOKS_LIKE_IP.test(raw)) return null;
		const addr = normalizeIp(raw); // ::ffff:1.2.3.4 → 1.2.3.4, so it matches IPv4 blocks
		try {
			const r = await this.query(addr);
			if (!r) return null;
			const loc: GeoLocation = {
				country: r.country_iso ?? null,
				countryName: r.country_name ?? null,
				subdivision: r.subdivision_iso ?? null,
				subdivisionName: r.subdivision_name ?? null,
				city: r.city_name ?? null,
				continent: r.continent_code ?? null,
				timeZone: r.time_zone ?? null,
				latitude: r.latitude != null ? Number(r.latitude) : null,
				longitude: r.longitude != null ? Number(r.longitude) : null,
				postalCode: r.postal_code ?? null,
				accuracyRadius: r.accuracy_radius != null ? Number(r.accuracy_radius) : null,
				geonameId: r.geoname_id != null && r.geoname_id !== '' ? Number(r.geoname_id) : null,
				asn: r.asn != null && r.asn !== '' ? `AS${r.asn}` : null,
				org: r.organization ?? null,
			};
			// Both lookups missed (the address is in neither dataset) → unknown.
			return Object.values(loc).some((v) => v !== null) ? loc : null;
		} catch (err) {
			// A bad ::inet cast means the input wasn't a real IP → quiet null (expected).
			// Anything else (connection drop, a latent query bug) is a real fault: we
			// still return null so a caller isn't crashed, but we LOG it — silently
			// swallowing it would let a risk gate fail open during an outage with no
			// trace, and would hide query regressions the fake-store unit tests can't.
			if ((err as { code?: string })?.code !== PG_INVALID_TEXT) {
				console.error('@fonderie/geo: lookup failed (returning null):', err);
			}
			return null;
		}
	}

	private async query(addr: string): Promise<LookupRow | undefined> {
		try {
			return (await this.store.query<LookupRow>(LOOKUP_WITH_ASN, [addr]))[0];
		} catch (err) {
			if ((err as { code?: string })?.code !== PG_UNDEFINED_TABLE) throw err;
			if (!warnedNoAsnTable) {
				warnedNoAsnTable = true;
				console.warn(
					'@fonderie/geo: geo_asn_blocks is missing — run migrations (003_geo_asn.sql). ' +
						'Serving City data without ASN until then.',
				);
			}
			return (await this.store.query<LookupRow>(LOOKUP_CITY_ONLY, [addr]))[0];
		}
	}
}

/** Test seam: the missing-table warning fires once per process by design. */
export function __resetAsnWarningForTests(): void {
	warnedNoAsnTable = false;
}
