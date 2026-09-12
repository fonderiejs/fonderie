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
	origin?: string | ((requestOrigin: string) => boolean);
	/**
	 * Allow credentialed requests. @fonderie/client always fetches with
	 * credentials:'include', so a browser frontend on another origin needs
	 * this on. Requires an explicit `origin` — browsers reject '*' on
	 * credentialed responses.
	 */
	credentials?: boolean;
}

export function withCors(options: CorsOptions = {}): Middleware {
	const {
		origin = '*',
		headers = DEFAULT_CORS_HEADERS,
		exposeHeaders = DEFAULT_CORS_EXPOSE_HEADERS,
		methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		credentials = false,
	} = options;

	// Browsers reject `Access-Control-Allow-Origin: *` on credentialed
	// requests — cookies demand a deliberate origin choice. Fail at boot with
	// a clear message, not per-request as an opaque browser error. Reflecting
	// every origin stays possible, but only as an explicit opt-in.
	if (credentials && origin === '*') {
		throw new Error(
			"withCors: credentials:true cannot be combined with origin:'*' (browsers reject it). " +
				'Pass the frontend origin, or a predicate — `origin: () => true` deliberately reflects any origin.',
		);
	}

	return async (ctx, next) => {
		const requestOrigin = ctx.request.headers.get('origin') ?? '';

		const allowOrigin =
			typeof origin === 'function' ? (origin(requestOrigin) ? requestOrigin : '') : origin;

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
		if (typeof origin === 'function') corsHeaders['Vary'] = 'Origin';

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
