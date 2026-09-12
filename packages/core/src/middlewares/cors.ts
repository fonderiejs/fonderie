import type { Middleware } from '../types';

// Request headers @fonderie/client sends on browser calls. A preflight
// rejects the WHOLE request when any of them is missing from the allow-list,
// so they ship as defaults here, in lockstep with the client:
//   X-Request-ID   — request correlation (client >= 0.19)
//   traceparent    — W3C trace context (client >= 0.20)
//   X-Workspace-ID — workspace scoping (setWorkspaceId)
export const FONDERIE_CLIENT_HEADERS = ['X-Request-ID', 'traceparent', 'X-Workspace-ID'];

export const DEFAULT_CORS_HEADERS = ['Content-Type', 'Authorization', ...FONDERIE_CLIENT_HEADERS];

// Response headers browser JS is allowed to read. Without X-Request-ID here
// the client cannot see the echoed correlation id — FonderieApiError.requestId
// would silently stay at the client-minted value instead of the server echo.
export const DEFAULT_CORS_EXPOSE_HEADERS = ['X-Request-ID'];

export interface CorsOptions {
	methods?: string[];
	headers?: string[];
	/** Response headers exposed to browser JS (Access-Control-Expose-Headers). */
	exposeHeaders?: string[];
	/**
	 * Who may call this API from a browser. A single origin, a list (apex and
	 * www are two different origins), or a predicate for patterns such as
	 * preview deployments.
	 *
	 * String forms are NORMALIZED — see normalizeOrigin. A predicate receives
	 * the raw `Origin` header and owns its own matching.
	 */
	origin?: string | string[] | ((requestOrigin: string) => boolean);
	/**
	 * Allow credentialed requests. @fonderie/client always fetches with
	 * credentials:'include', so a browser frontend on another origin needs
	 * this on. Requires an explicit `origin` — browsers reject '*' on
	 * credentialed responses.
	 */
	credentials?: boolean;
}

export type ResolvedCorsOptions = Required<CorsOptions>;

/**
 * An `Origin` header is `scheme://host[:port]` and, per RFC 6454, never carries
 * a path or a trailing slash — so a configured origin with one can never match
 * anything. That makes it unambiguously a typo rather than intent, and the
 * usual one: every address bar and dashboard "copy URL" hands you the slash.
 *
 * The failure it caused was a total outage with a misleading message — the
 * browser blocks every request and the app reports "can't reach the server" —
 * so normalizing beats honouring a value that cannot work. Scheme and host are
 * case-insensitive and browsers send them lowercased, so casing is folded too.
 *
 * A path (`https://x.com/app`) is a DIFFERENT mistake that normalizing cannot
 * silently repair, so it warns instead.
 */
export function normalizeOrigin(origin: string): string {
	const trimmed = origin.trim();
	if (trimmed === '*') return trimmed;

	const withoutTrailingSlashes = trimmed.replace(/\/+$/, '');

	// Lowercase only scheme://host[:port]; anything after would be a path,
	// which is reported below rather than quietly reshaped.
	const match = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+)(\/.*)?$/.exec(withoutTrailingSlashes);
	if (!match) return withoutTrailingSlashes;

	const [, schemeAndHost, path] = match;
	if (path) {
		console.warn(
			`[fonderie] CORS origin "${origin}" contains a path. An Origin header is ` +
				'scheme://host[:port] only, so this can never match a real request — ' +
				`use "${schemeAndHost!.toLowerCase()}".`,
		);
	}
	return schemeAndHost!.toLowerCase();
}

// Applies the defaults and rejects impossible combinations at boot. The
// framework adapters' native cors() middlewares resolve through here too, so
// every mounting style shares one contract and one failure mode.
export function resolveCorsOptions(options: CorsOptions = {}): ResolvedCorsOptions {
	const rawOrigin = options.origin ?? '*';
	const resolved: ResolvedCorsOptions = {
		origin:
			typeof rawOrigin === 'string'
				? normalizeOrigin(rawOrigin)
				: Array.isArray(rawOrigin)
					? rawOrigin.map(normalizeOrigin)
					: rawOrigin,
		headers: options.headers ?? DEFAULT_CORS_HEADERS,
		exposeHeaders: options.exposeHeaders ?? DEFAULT_CORS_EXPOSE_HEADERS,
		methods: options.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		credentials: options.credentials ?? false,
	};
	// Browsers reject `Access-Control-Allow-Origin: *` on credentialed
	// requests — cookies demand a deliberate origin choice. Fail at boot with
	// a clear message, not per-request as an opaque browser error. Reflecting
	// every origin stays possible, but only as an explicit opt-in.
	const allowsWildcard =
		resolved.origin === '*' ||
		(Array.isArray(resolved.origin) && resolved.origin.includes('*'));
	if (resolved.credentials && allowsWildcard) {
		throw new Error(
			"withCors: credentials:true cannot be combined with origin:'*' (browsers reject it). " +
				'Pass the frontend origin, or a predicate — `origin: () => true` deliberately reflects any origin.',
		);
	}
	return resolved;
}

// The response headers for one request. Pure — withCors and the adapters'
// native middlewares all emit exactly this, so the header contract cannot
// fork per framework.
export function corsHeadersFor(
	resolved: ResolvedCorsOptions,
	requestOrigin: string,
): Record<string, string> {
	const { origin, headers, exposeHeaders, methods, credentials } = resolved;

	// Echo the REQUEST's origin on a match, never the configured spelling: the
	// browser compares byte-for-byte against what it sent, so reflecting a
	// normalized-but-different string would fail the very check normalizing is
	// meant to survive.
	let allowOrigin: string;
	if (typeof origin === 'function') {
		allowOrigin = origin(requestOrigin) ? requestOrigin : '';
	} else if (Array.isArray(origin)) {
		allowOrigin = origin.includes(normalizeOrigin(requestOrigin)) ? requestOrigin : '';
	} else if (origin === '*') {
		allowOrigin = '*';
	} else {
		allowOrigin = normalizeOrigin(requestOrigin) === origin ? requestOrigin : '';
	}

	const corsHeaders: Record<string, string> = {
		'Access-Control-Max-Age': '86400',
		'Access-Control-Allow-Methods': methods.join(', '),
		'Access-Control-Allow-Headers': headers.join(', '),
	};
	if (exposeHeaders.length > 0) {
		corsHeaders['Access-Control-Expose-Headers'] = exposeHeaders.join(', ');
	}
	if (credentials) corsHeaders['Access-Control-Allow-Credentials'] = 'true';
	// Omit the header entirely for a denied origin (an empty ACAO value is
	// invalid); when the value varies by request origin, say so — otherwise a
	// shared cache can serve one origin's ACAO to another.
	if (allowOrigin) corsHeaders['Access-Control-Allow-Origin'] = allowOrigin;
	// Vary whenever the emitted value depends on the request — a shared cache
	// must not serve one origin's ACAO to another. Only the literal '*' is
	// request-independent.
	if (origin !== '*') corsHeaders['Vary'] = 'Origin';

	return corsHeaders;
}

export function withCors(options: CorsOptions = {}): Middleware {
	const resolved = resolveCorsOptions(options);

	return async (ctx, next) => {
		const corsHeaders = corsHeadersFor(resolved, ctx.request.headers.get('origin') ?? '');

		// Preflight — respond immediately, skip the pipeline
		if (ctx.request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		const response = await next();

		const patched = new Headers(response.headers);

		for (const [k, v] of Object.entries(corsHeaders)) {
			patched.set(k, v);
		}

		return new Response(response.body, {
			headers: patched,
			status: response.status,
			statusText: response.statusText,
		});
	};
}
