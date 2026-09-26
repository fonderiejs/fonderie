// Platform-provided geolocation — zero infrastructure.
//
// Every request that reaches a function on Vercel already carries the
// requester's country, region, city, time zone and coordinates as headers,
// set by the platform's edge from the connecting IP. Cloudflare does the same
// for country on every plan (region/city/coordinates with its "visitor
// location headers" managed transform). For an app deployed there, a MaxMind
// table is solving a problem the deployment does not have.
//
// The one thing that must be explicit is TRUST. A client can send
// `x-vercel-ip-country: US` to any server that is not behind Vercel, so this
// function believes a platform's headers only when the caller says which
// platform the process is actually running on — typically from the deployment
// environment (`process.env.VERCEL ? 'vercel' : undefined`). With no trusted
// source it returns null, never a guess.
import type { GeoLocation } from './types.js';

export type GeoHeaderSource = 'vercel' | 'cloudflare';

/** Anything header-shaped: a Fetch `Headers`, Node's `IncomingHttpHeaders`
 * record, or any object with `get(name)`. */
export type HeadersLike =
	| { get(name: string): string | null | undefined }
	| Record<string, string | string[] | undefined>;

export interface GeoFromHeadersOptions {
	/**
	 * Which platform's headers to believe, in order. Set it from the deployment
	 * environment and pass `undefined`/`null` when the process is not behind one
	 * of these platforms — the function then returns null. Never derive it from
	 * the request itself: the request is exactly what an attacker controls.
	 */
	trust: GeoHeaderSource | readonly GeoHeaderSource[] | null | undefined;
}

const SOURCES: Record<GeoHeaderSource, { [K in keyof HeaderMap]: string }> = {
	vercel: {
		country: 'x-vercel-ip-country',
		subdivision: 'x-vercel-ip-country-region',
		city: 'x-vercel-ip-city',
		continent: 'x-vercel-ip-continent',
		timeZone: 'x-vercel-ip-timezone',
		latitude: 'x-vercel-ip-latitude',
		longitude: 'x-vercel-ip-longitude',
	},
	cloudflare: {
		country: 'cf-ipcountry',
		subdivision: 'cf-region-code',
		city: 'cf-ipcity',
		continent: 'cf-ipcontinent',
		timeZone: 'cf-timezone',
		latitude: 'cf-iplatitude',
		longitude: 'cf-iplongitude',
	},
};

interface HeaderMap {
	country: string;
	subdivision: string;
	city: string;
	continent: string;
	timeZone: string;
	latitude: string;
	longitude: string;
}

// Cloudflare uses these in `cf-ipcountry` for "unknown" and "Tor exit node".
const CLOUDFLARE_NON_COUNTRIES = new Set(['XX', 'T1']);

function read(headers: HeadersLike, name: string): string | null {
	if (typeof (headers as { get?: unknown }).get === 'function') {
		const v = (headers as { get(name: string): string | null | undefined }).get(name);
		return typeof v === 'string' && v.length > 0 ? v : null;
	}
	const rec = headers as Record<string, string | string[] | undefined>;
	const raw = rec[name] ?? rec[name.toLowerCase()];
	const v = Array.isArray(raw) ? raw[0] : raw;
	return typeof v === 'string' && v.length > 0 ? v : null;
}

/** ISO-3166-1 alpha-2 (or a two-letter continent code): exactly two letters. */
function code(v: string | null): string | null {
	if (!v) return null;
	const t = v.trim();
	return /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : null;
}

/** ISO-3166-2 region part: one to three letters/digits. */
function region(v: string | null): string | null {
	if (!v) return null;
	const t = v.trim();
	return /^[A-Za-z0-9]{1,3}$/.test(t) ? t.toUpperCase() : null;
}

/** Free text (city). Vercel percent-encodes non-ASCII (RFC 3986). */
function text(v: string | null): string | null {
	if (!v) return null;
	let t = v;
	try {
		t = decodeURIComponent(v);
	} catch {
		// not percent-encoded; use as-is
	}
	t = t.trim();
	return t.length >= 1 && t.length <= 128 ? t : null;
}

/** IANA zone name such as `America/Toronto`, or `UTC`. */
function timeZone(v: string | null): string | null {
	if (!v) return null;
	const t = v.trim();
	return t === 'UTC' || /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/.test(t) ? t : null;
}

function coordinate(v: string | null, limit: number): number | null {
	if (!v) return null;
	const n = Number.parseFloat(v.trim());
	return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/**
 * Resolve the requester's location from the platform's edge headers.
 *
 * Returns the same `GeoLocation` shape as `PostgresGeoProvider.lookup()`, so a
 * consumer can use whichever source the deployment has. `countryName`,
 * `subdivisionName` and `accuracyRadius` are always null here — the platforms
 * send codes, not names.
 *
 * Country is decision-grade. Region and city are display-grade: IP
 * geolocation below country level is unreliable on mobile carriers and VPNs.
 */
export function geoFromHeaders(headers: HeadersLike, opts: GeoFromHeadersOptions): GeoLocation | null {
	const trust = opts.trust == null ? [] : Array.isArray(opts.trust) ? opts.trust : [opts.trust];
	for (const source of trust) {
		const names = SOURCES[source as GeoHeaderSource];
		if (!names) continue;
		let country = code(read(headers, names.country));
		if (source === 'cloudflare' && country && CLOUDFLARE_NON_COUNTRIES.has(country)) country = null;
		const loc: GeoLocation = {
			country,
			countryName: null,
			subdivision: region(read(headers, names.subdivision)),
			subdivisionName: null,
			city: text(read(headers, names.city)),
			continent: code(read(headers, names.continent)),
			timeZone: timeZone(read(headers, names.timeZone)),
			latitude: coordinate(read(headers, names.latitude), 90),
			longitude: coordinate(read(headers, names.longitude), 180),
			accuracyRadius: null,
		};
		// A source that set nothing usable is not the platform we are behind
		// (or it knew nothing); try the next trusted source rather than return
		// an all-null location.
		if (loc.country || loc.city || loc.subdivision || loc.continent || loc.timeZone) return loc;
	}
	return null;
}
