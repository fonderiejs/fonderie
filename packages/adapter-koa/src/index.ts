import type { IncomingMessage } from 'node:http';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie-js/core';

// Minimal Koa shape — no koa dep in this file, peer dep only
export interface KoaContext {
	request: {
		url:     string;
		method:  string;
		rawBody?: string;
		headers: Record<string, string | string[] | undefined>;
	}
	response: {
		body:   unknown;
		status: number;
		set(key: string, value: string): void;
	}
	req:   IncomingMessage;
	state: Record<string, unknown>;
}

export type KoaNext = () => Promise<void>

// ── Web Standard ↔ Koa translation ───────────────────────────────

export function koaContextToWeb(ctx: KoaContext): Request {
	const encrypted = (ctx.req.socket as { encrypted?: boolean }).encrypted
	const protocol  = encrypted ? 'https' : 'http'
	const host      = ctx.request.headers['host'] ?? 'localhost'
	const url       = `${protocol}://${host}${ctx.request.url}`

	const headers = new Headers()
	for (const [key, value] of Object.entries(ctx.request.headers)) {
		if (!value) continue
		if (Array.isArray(value)) {
			for (const v of value) headers.append(key, v)
		} else {
			headers.set(key, value)
		}
	}

	return new Request(url, {
		headers,
		method: ctx.request.method,
		body:   ctx.request.rawBody ?? null,
	})
}

export async function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void> {
	ctx.response.status = webRes.status
	webRes.headers.forEach((value, key) => ctx.response.set(key, value))
	ctx.response.body = await webRes.text()
}

// ── bridge ────────────────────────────────────────────────────────
//
// Koa middleware. Populates ctx.state._fonderie with the fonderie context
// (user, workspace, meta) for all subsequent route handlers.
//
//   app.use(bridge(fonderie))

export function bridge(fonderie: FonderieApp) {
	return async (ctx: KoaContext, next: KoaNext) => {
		const webReq      = koaContextToWeb(ctx)
		ctx.state['_fonderie'] = await fonderie.buildContext(webReq.clone())
		await next()
	}
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Wraps any fonderie Middleware into a Koa middleware function.
//
//   router.get('/jobs',
//     adapt(requireAuth),
//     adapt(withWorkspace(store)),
//     async (ctx) => { ... ctx.state._fonderie?.user ... }
//   )

export function adapt(middleware: Middleware) {
	return async (ctx: KoaContext, next: KoaNext) => {
		const fCtx = ctx.state['_fonderie'] as IFonderieContext | undefined
		if (!fCtx) throw new Error('[fonderie] bridge() must be registered before adapt()')

		let continued = false
		const result = await middleware(fCtx, async () => {
			continued = true
			return new Response()
		})

		if (continued) {
			await next()
		} else {
			await webResponseToKoa(result, ctx)
		}
	}
}

// ── mount ─────────────────────────────────────────────────────────
//
// Registers fonderie's infrastructure routes as a Koa catch-all middleware.
// Always call AFTER registering your own business routes.
//
//   app.use(router.routes())    // business routes — matched first
//   mount(app, fonderie)        // fonderie infra — catch-all, matched last

export function mount(app: { use: (fn: (ctx: KoaContext, next: KoaNext) => Promise<void>) => void }, fonderie: FonderieApp): void {
	app.use(async (ctx: KoaContext) => {
		const webReq = koaContextToWeb(ctx)
		const webRes = await fonderie.handle(webReq)
		await webResponseToKoa(webRes, ctx)
	})
}
