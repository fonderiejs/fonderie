import type { Context, MiddlewareHandler } from 'hono';
import type { Hono } from 'hono';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie/core';
import {
	requireAuth as _requireAuth,
	resolveClientIp,
	resolveCorsOptions,
	corsHeadersFor,
	type CorsOptions,
} from '@fonderie/core/middlewares';
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

export interface IBridgeOptions {
	/**
	 * Name of the header that carries the PLATFORM-VERIFIED client IP — e.g.
	 * 'cf-connecting-ip' on Cloudflare, 'x-real-ip' behind an nginx that sets
	 * it. This is an explicit opt-in: request headers are attacker-settable,
	 * so trusting one by default would let any client spoof its IP and dodge
	 * per-IP rate limits (auth brute-force limiters key on this). Only set it
	 * when your platform/proxy STRIPS the header from client requests and
	 * injects its own value.
	 */
	ipHeader?: string;
}

export function bridge(fonderie: FonderieApp, options: IBridgeOptions = {}): MiddlewareHandler {
	return async (c, next) => {
		// No clone(): teeing a request and fully reading ONE branch while the
		// other sits unread stalls once the body crosses the stream's
		// high-water mark (undici's tee applies backpressure from the slower
		// consumer). buildContext consumes the body and core's parser
		// re-materializes ctx.request from the buffered bytes, so mount() and
		// app routes read from THAT instead of the spent raw request.
		const ctx = await fonderie.buildContext(c.req.raw);
		// A global middleware short-circuited while building context (e.g. the
		// body parser's 413) — that response must reach the client, not be
		// swallowed by context-building.
		const early = ctx.meta['pipelineResponse'];
		if (early instanceof Response) return early;
		// buildContext CONSUMED c.req.raw's body (no clone — a tee stalls on
		// large bodies). Core's parser re-materialized ctx.request from the
		// buffered bytes; point Hono's request at it so the app's OWN native
		// handlers (c.req.json()/text()/parseBody()) still read the body —
		// otherwise they'd hit a drained stream. For content-types the parser
		// leaves untouched (multipart), ctx.request === the original, so this
		// is a no-op. bodyCache is empty here (nothing read yet).
		if (ctx.request !== c.req.raw) {
			(c.req as { raw: Request }).raw = ctx.request;
		}
		// Client IP, spoof-safe by default (mirrors core's trustProxy model):
		//   1. The real socket address when the runtime exposes one
		//      (@hono/node-server puts the node request on c.env.incoming).
		//   2. A platform header ONLY when explicitly configured via ipHeader.
		//   3. X-Forwarded-For only per core's TRUST_PROXY hop count.
		// Previously cf-connecting-ip/x-real-ip were trusted UNCONDITIONALLY,
		// which let any direct client forge its IP (fresh rate-limit bucket per
		// request) or omit it (limiter skipped) on self-hosted deployments.
		const socketIp = (
			c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined
		)?.incoming?.socket?.remoteAddress;
		const headerIp = options.ipHeader
			? (c.req.raw.headers.get(options.ipHeader) ?? undefined)
			: undefined;
		const clientIp = resolveClientIp(headerIp ?? socketIp ?? undefined, c.req.raw.headers);
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
	hono.notFound((c) => {
		// bridge() consumed the raw body (see its no-clone note) and core's
		// parser re-materialized ctx.request with the buffered bytes — route
		// fonderie's handling through THAT. Without bridge (no ctx), the raw
		// request is untouched and safe to hand over directly.
		const ctx = c.get('_fonderie') as IFonderieContext | undefined;
		// Hand over what only the adapter can observe — the socket-derived
		// client IP. handle() builds a fresh context, so without this seed every
		// fonderie-owned route sees no IP (login events, per-IP limits, geo/risk).
		const clientIp = ctx?.meta.clientIp;
		return fonderie.handle(ctx?.request ?? c.req.raw, clientIp ? { meta: { clientIp } } : undefined);
	});
	return hono;
}

// ── App-level CORS ────────────────────────────────────────────────
//
// Native Hono middleware speaking core's CORS contract — same options and
// defaults as withCors, so the headers @fonderie/client sends are allowed out
// of the box (unlike hono/cors, whose defaults know nothing about them).
// Register it on the Hono app itself so it covers EVERY route, including
// ones outside the fonderie pipeline: fonderie.use(withCors()) only guards
// the mounted basePath.
//
//   app.use('*', cors({ credentials: true, origin: process.env.FRONTEND_URL! }))

export function cors(options?: CorsOptions): MiddlewareHandler {
	const resolved = resolveCorsOptions(options);
	return async (c, next) => {
		const corsHeaders = corsHeadersFor(resolved, c.req.header('origin') ?? '');
		// Preflight — respond immediately, skip the pipeline
		if (c.req.method === 'OPTIONS') {
			return c.body(null, 204, corsHeaders);
		}
		await next();
		for (const [k, v] of Object.entries(corsHeaders)) {
			c.res.headers.set(k, v);
		}
	};
}
