// Optional location enrichment for auth events (login history, registrations,
// sessions).
//
// Auth never resolves a location itself and imports no geo code: the app hands
// in a resolver (IAuthConfig.location). Typical choices — the platform's
// edge headers via @fonderie/geo's geoFromHeaders (zero infrastructure), a
// self-hosted table, or a hosted IP API that also knows the network (ISP, ASN,
// proxy/VPN, hosting). Field names match @fonderie/geo's GeoLocation, so its
// result can be returned as-is.
//
// Whatever the resolver returns is treated as untrusted input: every field is
// type-checked and bounded before it is stored, and a resolver that throws or
// stalls costs the login nothing — the row is written without a location.

/** Where a login attempt came from. Every field is optional; unknown is null. */
export interface IRequestLocation {
	country?: string | null; // ISO-3166-1 alpha-2
	countryName?: string | null;
	subdivision?: string | null; // ISO-3166-2 region part (QC, CA, ENG)
	subdivisionName?: string | null;
	city?: string | null;
	/** Postal / ZIP code as the provider reports it (94043, K1A 0B1, SW1A). Approximate. */
	postalCode?: string | null;
	continent?: string | null; // two-letter continent code
	timeZone?: string | null; // IANA name
	latitude?: number | null;
	longitude?: number | null;
	/** How far off the point may be, in kilometres (MaxMind's accuracy_radius).
	 * Lets a UI say "near Mountain View (±20 km)" instead of implying precision. */
	accuracyRadius?: number | null;
	/** Network facts — only resolvers backed by an IP-intelligence API know these. */
	isp?: string | null;
	org?: string | null;
	asn?: string | null; // e.g. "AS15169"
	mobile?: boolean | null;
	proxy?: boolean | null;
	hosting?: boolean | null;
}

export interface ILocationRequest {
	/** The resolved client IP (adapter-resolved, proxy-aware), or null. */
	ip: string | null;
	/** The incoming request's headers — for platform geolocation headers. */
	headers: Headers;
}

export type LocationResolver = (
	req: ILocationRequest,
) => IRequestLocation | null | undefined | Promise<IRequestLocation | null | undefined>;

// How long auth waits for the resolver before writing the row without a
// location. Internal, deliberately not exported. It is zero-cost for in-process
// resolvers (edge headers return in microseconds) and exists for the ones that
// are not: @fonderie/geo's PostgresGeoProvider does a DB query that can hang
// on an exhausted pool, and an app may choose a hosted IP-intelligence API for
// richer data (ISP, ASN, proxy/VPN, accuracy radius). A legitimate lookup
// answers in a few to ~150 ms; the session write that triggers resolution is
// on the login path, so the cap bounds the worst-case delay a slow provider
// can add to a sign-in.
const LOCATION_TIMEOUT_MS = 500;

const TEXT_MAX = 128;

function str(v: unknown, re?: RegExp): string | null {
	if (typeof v !== 'string') return null;
	const t = v.trim();
	if (t.length === 0 || t.length > TEXT_MAX) return null;
	return re && !re.test(t) ? null : t;
}
function upperCode(v: unknown, re: RegExp): string | null {
	const t = str(v, re);
	return t ? t.toUpperCase() : null;
}
function bool(v: unknown): boolean | null {
	return typeof v === 'boolean' ? v : null;
}
// Two decimals ≈ 1 km: plenty for "which city", and a login history should not
// keep more precision than the city it names.
function coord(v: unknown, limit: number): number | null {
	if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > limit) return null;
	return Math.round(v * 100) / 100;
}

// Kilometres, a positive whole number. MaxMind's values run 1–1000; anything
// beyond the planet's half-circumference is not a radius.
function radius(v: unknown): number | null {
	if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 20_000) return null;
	return Math.round(v);
}

/** Keep only well-formed, bounded fields. Returns null when nothing survives. */
export function sanitizeLocation(input: unknown): IRequestLocation | null {
	if (!input || typeof input !== 'object') return null;
	const i = input as Record<string, unknown>;
	const out: IRequestLocation = {
		country: upperCode(i['country'], /^[A-Za-z]{2}$/),
		countryName: str(i['countryName']),
		subdivision: upperCode(i['subdivision'], /^[A-Za-z0-9]{1,3}$/),
		subdivisionName: str(i['subdivisionName']),
		city: str(i['city']),
		postalCode: upperCode(i['postalCode'], /^[A-Za-z0-9][A-Za-z0-9 -]{0,11}$/),
		continent: upperCode(i['continent'], /^[A-Za-z]{2}$/),
		timeZone: str(i['timeZone'], /^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/),
		latitude: coord(i['latitude'], 90),
		longitude: coord(i['longitude'], 180),
		accuracyRadius: radius(i['accuracyRadius']),
		isp: str(i['isp']),
		org: str(i['org']),
		asn: upperCode(i['asn'], /^AS\d{1,10}$/i),
		mobile: bool(i['mobile']),
		proxy: bool(i['proxy']),
		hosting: bool(i['hosting']),
	};
	// Drop nulls so the stored JSON carries only what is known.
	const known = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null)) as IRequestLocation;
	return Object.keys(known).length > 0 ? known : null;
}

/** Run the resolver bounded by a timeout; never throws. */
// One resolution per request: a sign-in writes a login-event row AND a session
// row, and both ask. Keyed on the request's Headers object (unique per
// request, collected with it), so the resolver — possibly a paid API — runs
// once.
const perRequest = new WeakMap<Headers, { resolver: LocationResolver; result: Promise<IRequestLocation | null> }>();

export function resolveLocation(
	resolver: LocationResolver | undefined,
	req: ILocationRequest,
	timeoutMs = LOCATION_TIMEOUT_MS,
): Promise<IRequestLocation | null> {
	if (!resolver) return Promise.resolve(null);
	const cached = perRequest.get(req.headers);
	if (cached && cached.resolver === resolver) return cached.result;
	const result = resolveOnce(resolver, req, timeoutMs);
	perRequest.set(req.headers, { resolver, result });
	return result;
}

async function resolveOnce(
	resolver: LocationResolver,
	req: ILocationRequest,
	timeoutMs: number,
): Promise<IRequestLocation | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const result = await Promise.race([
			Promise.resolve().then(() => resolver(req)),
			new Promise<null>((resolve) => {
				timer = setTimeout(() => resolve(null), timeoutMs);
			}),
		]);
		return sanitizeLocation(result);
	} catch (err) {
		console.warn('[auth] location resolver failed; recording without a location:', err);
		return null;
	} finally {
		if (timer) clearTimeout(timer);
	}
}
