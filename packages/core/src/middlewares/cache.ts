import type { Middleware } from '../types';

export interface IWithCacheOptions {
	/** Seconds a client may reuse the response without asking again. */
	maxAge: number;
	/**
	 * Who may keep it. 'private' (default): only the requesting client — right
	 * for anything signed-in. 'public': shared caches (a CDN) may keep it too —
	 * only for responses identical for everyone.
	 */
	scope?: 'private' | 'public';
}

/**
 * Declare how long clients may cache a route's GET response, as a standard
 * `Cache-Control` header — the endpoint knows how volatile its data is; the
 * client should not guess. @fonderie/client honours it (an explicit per-call
 * option still wins), and so do browsers and CDNs.
 *
 *   v1.get('/catalog', withCache({ maxAge: 300 }), handler)   // 5 minutes, this client only
 *   v1.get('/live',    withCache(false), handler)             // never cached
 *
 * A `Cache-Control` the handler set itself is kept: the handler is more
 * specific than the route's policy.
 */
export function withCache(options: IWithCacheOptions | false): Middleware {
	const value = cacheControlValue(options);
	return async (_ctx, next) => {
		const response = await next();
		if (response.headers.has('cache-control')) return response;
		const headers = new Headers(response.headers);
		headers.set('cache-control', value);
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	};
}

/** The Cache-Control value for a policy — shared with the framework adapters. */
export function cacheControlValue(options: IWithCacheOptions | false): string {
	return options === false ? 'no-store' : `${options.scope ?? 'private'}, max-age=${Math.max(0, Math.floor(options.maxAge))}`;
}
