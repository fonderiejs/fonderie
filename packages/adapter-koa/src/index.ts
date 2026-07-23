import type { IncomingMessage } from 'node:http';
import type Koa                from 'koa';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KoaMiddleware<S = any, C = any> = Koa.Middleware<S, C>;

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

// Minimal Koa shape used internally for Web Standard translation.
// Application code uses Koa's own context types (Koa.ParameterizedContext).
export interface KoaContext {
	request: {
		url: string;
		method: string;
		rawBody?: string;
		headers: Record<string, string | string[] | undefined>;
	};
	response: {
		body: unknown;
		status: number;
		set(key: string, value: string | string[]): void;
	};
	req: IncomingMessage;
	state: Record<string, unknown>;
}

export type KoaNext = () => Promise<void>;

// ── Web Standard ↔ Koa translation ───────────────────────────────

export function koaContextToWeb(ctx: KoaContext): Request {
	const encrypted = (ctx.req.socket as { encrypted?: boolean }).encrypted;
	const protocol = encrypted ? 'https' : 'http';
	const host = ctx.request.headers['host'] ?? 'localhost';
	const url = `${protocol}://${host}${ctx.request.url}`;

	const headers = new Headers();
	for (const [key, value] of Object.entries(ctx.request.headers)) {
		if (!value) continue;
		if (Array.isArray(value)) {
			for (const v of value) headers.append(key, v);
		} else {
			headers.set(key, value);
		}
	}

	const method = ctx.request.method.toUpperCase();
	const hasBody = method !== 'GET' && method !== 'HEAD';

	return new Request(url, {
		headers,
		method,
		body: hasBody ? (ctx.request.rawBody ?? null) : null,
	});
}

export async function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void> {
	ctx.response.status = webRes.status;
	// Set-Cookie must be forwarded as a LIST — forEach + set() would overwrite all
	// but the last cookie (and joining them into one header is invalid).
	const setCookies = webRes.headers.getSetCookie?.() ?? [];
	if (setCookies.length) ctx.response.set('Set-Cookie', setCookies);
	webRes.headers.forEach((value, key) => {
		if (key.toLowerCase() !== 'set-cookie') ctx.response.set(key, value);
	});
	ctx.response.body = await webRes.text();
}

// ── bridge ────────────────────────────────────────────────────────
//
// Koa middleware. Populates ctx.state._fonderie with the fonderie context
// (user, workspace, meta) for all subsequent route handlers.
// Requires koa-bodyparser (or equivalent) to run first so rawBody is set.
//
//   app.use(bodyParser())
//   app.use(bridge(fonderie))

export function bridge(fonderie: FonderieApp): KoaMiddleware {
	return async (ctx, next) => {
		const webReq = koaContextToWeb(ctx as unknown as KoaContext);
		const fCtx = await fonderie.buildContext(webReq.clone());
		const clientIp = resolveClientIp(
			(ctx as unknown as KoaContext).req.socket?.remoteAddress ?? undefined,
			webReq.headers,
		);
		if (clientIp) fCtx.meta.clientIp = clientIp;
		ctx.state['_fonderie'] = fCtx;
		await next();
	};
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Low-level escape hatch — wraps any fonderie Middleware into a Koa
// middleware function. Use this for custom fonderie middleware; prefer the
// named exports below for the built-in fonderie guards.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adapt(middleware: Middleware): KoaMiddleware<any, any> {
	return async (ctx, next) => {
		const fCtx = (ctx.state as Record<string, unknown>)['_fonderie'] as
			| IFonderieContext
			| undefined;
		if (!fCtx) throw new Error('[fonderie] bridge() must be registered before adapt()');

		let continued = false;
		const result = await middleware(fCtx, async () => {
			continued = true;
			return new Response();
		});

		if (continued) {
			await next();
		} else {
			await webResponseToKoa(result, ctx as unknown as KoaContext);
		}
	};
}

// ── Pre-adapted middleware ────────────────────────────────────────
//
// Drop-in replacements for the fonderie middleware functions — no adapt()
// needed. Import directly from this package instead of from the source
// packages, and use them as native Koa middleware.
//
//   router.get('/jobs', requireAuth, withWorkspace(store), ...)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireAuth: KoaMiddleware<any, any> = adapt(_requireAuth);

// The three guards below wrap OPTIONAL peers, so the peer is imported lazily
// on first request — not at module load. Koa middleware is async either way,
// so the extra await changes nothing for callers.

export function withWorkspace(
	store: Parameters<typeof _withWorkspace>[0],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): KoaMiddleware<any, any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let inner: KoaMiddleware<any, any> | undefined;
	return async (ctx, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/workspaces'),
				'@fonderie/workspaces',
				'withWorkspace()',
			);
			inner = adapt(mod.withWorkspace(store));
		}
		return inner(ctx, next);
	};
}

export function requirePermission(
	operation: Parameters<typeof _requirePermission>[0],
	permissionKey: Parameters<typeof _requirePermission>[1],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): KoaMiddleware<any, any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let inner: KoaMiddleware<any, any> | undefined;
	return async (ctx, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/permissions'),
				'@fonderie/permissions',
				'requirePermission()',
			);
			inner = adapt(mod.requirePermission(operation, permissionKey));
		}
		return inner(ctx, next);
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireFeature(key: string): KoaMiddleware<any, any> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let inner: KoaMiddleware<any, any> | undefined;
	return async (ctx, next) => {
		if (!inner) {
			const mod = await loadOptionalPeer(
				() => import('@fonderie/billing'),
				'@fonderie/billing',
				'requireFeature()',
			);
			inner = adapt(mod.requireFeature(key));
		}
		return inner(ctx, next);
	};
}

// ── mount ─────────────────────────────────────────────────────────
//
// Wires up fonderie to a Koa app. Uses Koa's onion model to register a
// single wrap-around middleware: builds fonderie context, calls next()
// so user routes run, then falls back to fonderie infra only if the
// request was not handled (ctx.body is still undefined).
//
// Routes registered after mount() are included automatically — Koa
// composes all middlewares lazily at request time, not at registration.
//
//   app.use(bodyParser())
//   const api = mount(app, fonderie)   // returns same app
//   api.use(router.routes())
//   api.use(router.allowedMethods())
//   app.listen(port)

export function mount(app: Koa, fonderie: FonderieApp): Koa {
	app.use(async (ctx, next) => {
		const webReq = koaContextToWeb(ctx as unknown as KoaContext);
		const fCtx = await fonderie.buildContext(webReq.clone());
		const clientIp = resolveClientIp(
			(ctx as unknown as KoaContext).req.socket?.remoteAddress ?? undefined,
			webReq.headers,
		);
		if (clientIp) fCtx.meta.clientIp = clientIp;
		ctx.state['_fonderie'] = fCtx;
		await next();
		if (ctx.body === undefined) {
			const webRes = await fonderie.handle(webReq);
			await webResponseToKoa(webRes, ctx as unknown as KoaContext);
		}
	});
	return app;
}
