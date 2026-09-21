import type { IFonderieContext, IRouteEntry, IRouteMatch, IRouter, Middleware } from './types';

interface IRoute {
	method: string;
	path: string;
	handler: Middleware;
	module: string | undefined;
}

interface IReservation {
	prefix: string;
	module: string | undefined;
}

export class Router implements IRouter {
	private routes: IRoute[] = [];
	private reservations: IReservation[] = [];

	add(method: string, path: string, handler: Middleware, module?: string): void {
		const reservation = this.reservationFor(path);
		if (reservation && reservation.module !== module) {
			throw new Error(
				`[fonderie] ${describe(module)} cannot mount ${method.toUpperCase()} ${path}: ` +
					`the prefix ${reservation.prefix} is reserved by ${describe(reservation.module)}`,
			);
		}
		this.routes.push({ method: method.toUpperCase(), path, handler, module });
	}

	// Claim a path prefix. Nothing but the reserving module may mount under it,
	// before or after the claim — a route already sitting there fails the
	// reservation, a route added later fails at add(). Both surface at boot,
	// so a namespace collision is a startup error, never a silently shadowed
	// route (the router is first-match-wins and would say nothing).
	reserve(prefix: string, module?: string): void {
		const clean = normalizePrefix(prefix);
		const existing = this.reservations.find((r) => r.prefix === clean);
		if (existing) {
			if (existing.module === module) return;
			throw new Error(
				`[fonderie] ${describe(module)} cannot reserve ${clean}: already reserved by ${describe(existing.module)}`,
			);
		}
		const squatter = this.routes.find((r) => isUnder(r.path, clean) && r.module !== module);
		if (squatter) {
			throw new Error(
				`[fonderie] ${describe(module)} cannot reserve ${clean}: ` +
					`${describe(squatter.module)} already mounted ${squatter.method} ${squatter.path} under it`,
			);
		}
		this.reservations.push({ prefix: clean, module });
	}

	// The route table as registered — method, full path (basePath included),
	// and the module that mounted it (absent for app-level routes). Feeds
	// operator introspection; handlers are deliberately not exposed.
	list(): IRouteEntry[] {
		return this.routes.map(({ method, path, module }) =>
			module ? { method, path, module } : { method, path },
		);
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

	private reservationFor(path: string): IReservation | undefined {
		return this.reservations.find((r) => isUnder(path, r.prefix));
	}
}

// A prefix owns itself and everything below it: `/_admin` covers `/_admin`
// and `/_admin/x`, not `/_adminx`.
function isUnder(path: string, prefix: string): boolean {
	return path === prefix || path.startsWith(`${prefix}/`);
}

function normalizePrefix(prefix: string): string {
	const clean = prefix.replace(/\/+$/, '');
	if (!clean.startsWith('/') || clean === '') {
		throw new Error(
			`[fonderie] a reserved prefix must be an absolute path below the root, got "${prefix}"`,
		);
	}
	return clean;
}

function describe(module: string | undefined): string {
	return module ?? 'the application';
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
			// A malformed percent-encoding (e.g. a lone '%') makes
			// decodeURIComponent throw — treat it as no-match (404) rather than
			// letting it bubble to a 500. A decoded NUL byte is rejected too:
			// it has no legitimate place in a path param and is a classic
			// truncation/injection primitive for downstream consumers.
			let decoded: string;
			try {
				decoded = decodeURIComponent(vs);
			} catch {
				return null;
			}
			if (decoded.includes('\0')) return null;
			params[ps.slice(1)] = decoded;
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
