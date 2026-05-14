import type { IncomingMessage } from 'node:http';
import type Koa                from 'koa';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KoaMiddleware<S = any, C = any> = Koa.Middleware<S, C>;

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie-js/core';
import { requireAuth as _requireAuth } from '@fonderie-js/core/middlewares';
import { withWorkspace as _withWorkspace } from '@fonderie-js/workspaces';
import { requirePermission as _requirePermission } from '@fonderie-js/permissions';
import { requireFeature as _requireFeature } from '@fonderie-js/billing';

export { OPERATIONS } from '@fonderie-js/permissions';

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
		set(key: string, value: string): void;
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

	return new Request(url, {
		headers,
		method: ctx.request.method,
		body: ctx.request.rawBody ?? null,
	});
}

export async function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void> {
	ctx.response.status = webRes.status;
	webRes.headers.forEach((value, key) => ctx.response.set(key, value));
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
		ctx.state['_fonderie'] = await fonderie.buildContext(webReq.clone());
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

export function withWorkspace(
	store: Parameters<typeof _withWorkspace>[0],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): KoaMiddleware<any, any> {
	return adapt(_withWorkspace(store));
}

export function requirePermission(
	operation: Parameters<typeof _requirePermission>[0],
	permissionKey: Parameters<typeof _requirePermission>[1],
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): KoaMiddleware<any, any> {
	return adapt(_requirePermission(operation, permissionKey));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function requireFeature(key: string): KoaMiddleware<any, any> {
	return adapt(_requireFeature(key));
}

// ── mount ─────────────────────────────────────────────────────────
//
// Registers fonderie's infrastructure routes as a Koa catch-all middleware.
// Always call AFTER registering your own business routes.
//
//   app.use(router.routes())    // business routes — matched first
//   mount(app, fonderie)        // fonderie infra — catch-all, matched last

export function mount(app: Koa, fonderie: FonderieApp): void {
	app.use(async (ctx) => {
		const webReq = koaContextToWeb(ctx as unknown as KoaContext);
		const webRes = await fonderie.handle(webReq);
		await webResponseToKoa(webRes, ctx as unknown as KoaContext);
	});
}
