import type { IRouter, Middleware, IRouteMatch, IFonderieContext } from './types';

export class Router implements IRouter {
	private routes: Array<{ method: string; path: string; handler: Middleware }> = [];

	add(method: string, path: string, handler: Middleware): void {
		this.routes.push({ method: method.toUpperCase(), path, handler });
	}

	match(method: string, path: string): IRouteMatch | null {
		for (const route of this.routes) {
			if (route.method !== method.toUpperCase()) {
				continue;
			}
			const params = matchPath(route.path, path);
			if (params !== null) {
				return { handler: route.handler, params };
			}
		}
		return null;
	}
}

// Segment-by-segment match with :param extraction
// /users/:id matches /users/42 → { id: '42' }
function matchPath(pattern: string, path: string): Record<string, string> | null {
	const clean = (path.split('?')[0] ?? path).replace(/\/$/, '') || '/'; // strip query string and trailing slash
	const pp = pattern.split('/');
	const vp = clean.split('/');

	if (pp.length !== vp.length) {
		return null;
	}

	const params: Record<string, string> = {};

	for (let i = 0; i < pp.length; i++) {
		const ps = pp[i] ?? '';
		const vs = vp[i] ?? '';
		if (ps.startsWith(':')) {
			params[ps.slice(1)] = decodeURIComponent(vs);
		} else if (ps !== vs) {
			return null;
		}
	}

	return params;
}

// Middleware that runs the router inside the pipeline
export function routerMiddleware(router: Router): Middleware {
	return async (ctx: IFonderieContext, next) => {
		const url = new URL(ctx.request.url);
		const match = router.match(ctx.request.method, url.pathname);

		if (!match) {
			return next();
		}

		// Route params available to handlers via ctx.meta.params
		ctx.meta.params = match.params;
		return match.handler(ctx, next);
	};
}
