import type { IncomingMessage }                  from 'node:http';
import type { Middleware as KoaMiddleware, Application } from 'koa';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie-js/core';

// Minimal Koa shape used internally for Web Standard translation.
// Application code uses Koa's own context types (Koa.ParameterizedContext).
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
// Requires koa-bodyparser (or equivalent) to run first so rawBody is set.
//
//   app.use(bodyParser())
//   app.use(bridge(fonderie))

export function bridge(fonderie: FonderieApp): KoaMiddleware {
	return async (ctx, next) => {
		const webReq           = koaContextToWeb(ctx as unknown as KoaContext)
		ctx.state['_fonderie'] = await fonderie.buildContext(webReq.clone())
		await next()
	}
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Wraps any fonderie Middleware into a Koa middleware function.
// Returns KoaMiddleware<any, any> so it's directly assignable in both
// app.use() and typed router chains — no cast helper needed.
//
//   router.get('/jobs',
//     adapt(requireAuth),
//     adapt(withWorkspace(store)),
//     async (ctx) => { ctx.state._fonderie.user }
//   )

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adapt(middleware: Middleware): KoaMiddleware<any, any> {
	return async (ctx, next) => {
		const fCtx = (ctx.state as Record<string, unknown>)['_fonderie'] as IFonderieContext | undefined
		if (!fCtx) throw new Error('[fonderie] bridge() must be registered before adapt()')

		let continued = false
		const result = await middleware(fCtx, async () => {
			continued = true
			return new Response()
		})

		if (continued) {
			await next()
		} else {
			await webResponseToKoa(result, ctx as unknown as KoaContext)
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

export function mount(app: Application, fonderie: FonderieApp): void {
	app.use(async (ctx) => {
		const webReq = koaContextToWeb(ctx as unknown as KoaContext)
		const webRes = await fonderie.handle(webReq)
		await webResponseToKoa(webRes, ctx as unknown as KoaContext)
	})
}
