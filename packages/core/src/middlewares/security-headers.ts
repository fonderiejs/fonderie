import type { Middleware } from '../types';

export interface SecurityHeadersOptions {
	// HSTS max-age in seconds. Default 180 days. Set 0 to omit the header.
	hstsMaxAge?: number;
	// Add `includeSubDomains` to the HSTS header. Off by default — only enable
	// once every subdomain is known to serve HTTPS.
	hstsIncludeSubDomains?: boolean;
	// Add `preload` to the HSTS header (implies includeSubDomains). Off by default.
	hstsPreload?: boolean;
}

// Baseline response hardening. `X-Content-Type-Options: nosniff` is always safe.
// HSTS is only meaningful — and only emitted — over HTTPS: browsers ignore it on
// plain HTTP, so gating on the effective scheme keeps local http/dev untouched
// while enforcing TLS in production (behind a TLS-terminating proxy, detected via
// X-Forwarded-Proto). Wired into the default pipeline by FonderieApp.
export function withSecurityHeaders(options: SecurityHeadersOptions = {}): Middleware {
	const {
		hstsMaxAge = 60 * 60 * 24 * 180,
		hstsIncludeSubDomains = false,
		hstsPreload = false,
	} = options;

	let hsts = '';
	if (hstsMaxAge > 0) {
		hsts = `max-age=${hstsMaxAge}`;
		if (hstsIncludeSubDomains || hstsPreload) hsts += '; includeSubDomains';
		if (hstsPreload) hsts += '; preload';
	}

	return async (ctx, next) => {
		const response = await next();
		const patched = new Headers(response.headers);

		patched.set('X-Content-Type-Options', 'nosniff');

		if (hsts && isHttps(ctx.request)) {
			patched.set('Strict-Transport-Security', hsts);
		}

		return new Response(response.body, {
			headers: patched,
			status: response.status,
			statusText: response.statusText,
		});
	};
}

// HTTPS if the request URL is https, or a TLS-terminating proxy says so.
function isHttps(request: Request): boolean {
	if (request.url.startsWith('https:')) return true;
	const proto = request.headers.get('x-forwarded-proto');
	return proto?.split(',')[0]?.trim() === 'https';
}
