import type { Context, MiddlewareHandler } from 'hono';
import type { Hono } from 'hono';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie/core';
import { requireAuth as _requireAuth, resolveClientIp } from '@fonderie/core/middlewares';
// Optional peers: type-only imports (erased at runtime). The guard factories
// below load them lazily so installing this adapter never requires
// @fonderie/workspaces, @fonderie/permissions, or @fonderie/billing unless
// the corresponding guard is actually used.
import type { withWorkspace as _withWorkspace } from '@fonderie/workspaces';
import type { requirePermission as _requirePermission } from '@fonderie/permissions';

export { OPERATIONS } from '@fonderie/core';

async function loadOptionalPeer<T>(load: () => Promise<T>, pkg: string, api: string): Promise<T> {
	try {
		return await load();
	} catch (err) {
		const e = err as { code?: string; message?: string } | undefined;
		const notFound = e?.code === 'ERR_MODULE_NOT_FOUND' || e?.code === 'MODULE_NOT_FOUND';
		// Only claim the peer is missing when the unresolved specifier IS the
		// peer — a transitive failure inside an installed peer must surface
		// as-is, not as a misleading install hint.
		const missing = notFound ? /Cannot find (?:package|module) '([^']+)'/.exec(e?.message ?? '')?.[1] : undefined;
		if (missing === pkg || missing?.startsWith(pkg + '/')) {
			throw new Error(
				`[fonderie] ${api} requires the optional peer dependency "${pkg}". Install it: npm install ${pkg}`,
			);
		}
		throw err;
	}
}

// Augment Hono's ContextVariableMap so c.get('_fonderie') is typed.
declare module 'hono' {
	interface ContextVariableMap {
		_fonderie: IFonderieContext;
	}
}

// Re-export for consumers who want to type their Hono app:
//   const hono = new Hono<{ Variables: FonderieVariables }>()
export type FonderieVariables = {
	_fonderie: IFonderieContext;
};

// ── bridge ────────────────────────────────────────────────────────
//
// Global middleware. Runs fonderie's session + billing global stack so that
// ctx.user and ctx.meta['billing'] are available in every route handler.
// Must be registered before any fonderie-aware route middleware.
//
//   hono.use('*', bridge(fonderie))

export function bridge(fonderie: FonderieApp): MiddlewareHandler {
	return async (c, next) => {
		const ctx = await fonderie.buildContext(c.req.raw.clone());
		// Hono runs on web-standard runtimes with no socket handle; edge
		// platforms hand the verified client IP via their own header.
		const platformIp =
			c.req.raw.headers.get('cf-connecting-ip') ??
			c.req.raw.headers.get('x-real-ip') ??
			undefined;
		const clientIp = resolveClientIp(platformIp, c.req.raw.headers);
		if (clientIp) ctx.meta.clientIp = clientIp;
		c.set('_fonderie', ctx);
		await next();
	};
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Low-level escape hatch — wraps any fonderie Middleware into a Hono
// MiddlewareHandler. Use this for custom fonderie middleware; prefer the
// named exports below for the built-in fonderie guards.

export function adapt(middleware: Middleware): MiddlewareHandler {
	return async (c: Context, next) => {
		const ctx = c.get('_fonderie');
		if (!ctx) throw new Error('[fonderie] bridge() must be registered before adapt()');

		let continued = false;
		const result = await middleware(ctx, async () => {
			continued = true;
			return new Response();
		});

		if (continued) {
			await next();
		} else {
			return result;
		}
	};
}

// ── Pre-adapted middleware ────────────────────────────────────────
//
// Drop-in replacements for the fonderie middleware functions — no adapt()
// needed. Import directly from this package instead of from the source
// packages, and use them as native Hono middleware.
//
//   hono.get('/jobs', requireAuth, withWorkspace(store), ...)

export const requireAuth: MiddlewareHandler = adapt(_requireAuth);

// The three guards below wrap OPTIONAL peers, so the peer is imported lazily
// on first request — not at module load. MiddlewareHandler is async either
// way, so the extra await changes nothing for callers.

export function withWorkspace(store: Parameters<typeof _withWorkspace>[0]): MiddlewareHandler {
	let inner: MiddlewareHandler | undefined;
	return async (c, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/workspaces'),
				'@fonderie/workspaces',
				'withWorkspace()',
			);
			inner = adapt(mod.withWorkspace(store));
		}
		return inner(c, next);
	};
}

export function requirePermission(
	operation: Parameters<typeof _requirePermission>[0],
	permissionKey: Parameters<typeof _requirePermission>[1],
): MiddlewareHandler {
	let inner: MiddlewareHandler | undefined;
	return async (c, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/permissions'),
				'@fonderie/permissions',
				'requirePermission()',
			);
			inner = adapt(mod.requirePermission(operation, permissionKey));
		}
		return inner(c, next);
	};
}

export function requireFeature(key: string): MiddlewareHandler {
	let inner: MiddlewareHandler | undefined;
	return async (c, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/billing'),
				'@fonderie/billing',
				'requireFeature()',
			);
			inner = adapt(mod.requireFeature(key));
		}
		return inner(c, next);
	};
}

// ── mount ─────────────────────────────────────────────────────────
//
// Wires up fonderie to a Hono app. Returns the same app so you can add
// routes after mount() — fonderie infra is the notFound handler, so
// user routes always take priority:
//
//   const api = mount(hono, fonderie)
//   api.get('/v1/todos', requireAuth, handler)
//   export default hono

// mount() wires fonderie's infrastructure routes as the notFound fallback so
// user routes always take priority. Call bridge() yourself before your routes
// to ensure _fonderie is populated for them.
export function mount(hono: Hono, fonderie: FonderieApp): Hono {
	hono.notFound((c) => fonderie.handle(c.req.raw));
	return hono;
}
