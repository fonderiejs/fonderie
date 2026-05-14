import type { IncomingMessage, ServerResponse } from 'node:http';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie-js/core';
import { requireAuth as _requireAuth }                    from '@fonderie-js/core/middlewares';
import { withWorkspace as _withWorkspace }                from '@fonderie-js/workspaces';
import { requirePermission as _requirePermission }        from '@fonderie-js/permissions';
import { requireFeature as _requireFeature }              from '@fonderie-js/billing';

export { OPERATIONS } from '@fonderie-js/permissions';

export type ExpressRequest  = IncomingMessage & { body?: unknown; _fonderie?: IFonderieContext }
export type ExpressResponse = ServerResponse
export type ExpressNext     = (err?: unknown) => void

// ── Web Standard ↔ Express translation ───────────────────────────

export async function expressRequestToWeb(req: ExpressRequest): Promise<Request> {
	const encrypted = (req.socket as { encrypted?: boolean }).encrypted
	const protocol  = encrypted ? 'https' : 'http'
	const host      = req.headers['host'] ?? 'localhost'
	const url       = `${protocol}://${host}${req.url ?? '/'}`

	const headers = new Headers()
	for (const [key, value] of Object.entries(req.headers)) {
		if (!value) continue
		if (Array.isArray(value)) {
			for (const v of value) headers.append(key, v)
		} else {
			headers.set(key, value)
		}
	}

	const method  = req.method ?? 'GET'
	const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
	const body    = hasBody ? await readStream(req) : null

	return new Request(url, { method, headers, body })
}

export async function webResponseToExpress(webRes: Response, res: ExpressResponse): Promise<void> {
	res.statusCode = webRes.status
	webRes.headers.forEach((value, key) => res.setHeader(key, value))
	res.end(Buffer.from(await webRes.arrayBuffer()))
}

function readStream(req: IncomingMessage): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on('data',  (chunk: Buffer) => chunks.push(chunk))
		req.on('end',   () => {
			const buf = Buffer.concat(chunks)
			// slice creates a correctly-sized ArrayBuffer (buf.buffer is a shared pool)
			resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
		})
		req.on('error', reject)
	})
}

// ── bridge ────────────────────────────────────────────────────────
//
// Express middleware. Populates req._fonderie with the fonderie context
// (user, workspace, meta) for all subsequent route handlers.
// Also forwards the parsed body to req.body.
//
//   app.use(bridge(fonderie))

export function bridge(fonderie: FonderieApp) {
	return async (req: ExpressRequest, _res: ExpressResponse, next: ExpressNext) => {
		try {
			const webReq  = await expressRequestToWeb(req)
			req._fonderie = await fonderie.buildContext(webReq.clone())
			if (req._fonderie.meta['body'] !== undefined) {
				req.body = req._fonderie.meta['body']
			}
			next()
		} catch (err) {
			next(err)
		}
	}
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Low-level escape hatch — wraps any fonderie Middleware into an Express
// middleware function. Use this for custom fonderie middleware; prefer the
// named exports below for the built-in fonderie guards.

export function adapt(middleware: Middleware) {
	return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
		const ctx = req._fonderie
		if (!ctx) { next(new Error('[fonderie] bridge() must be registered before adapt()')); return }

		let continued = false
		const result = await middleware(ctx, async () => {
			continued = true
			return new Response()
		})

		if (continued) {
			next()
		} else {
			await webResponseToExpress(result, res)
		}
	}
}

// ── Pre-adapted middleware ────────────────────────────────────────
//
// Drop-in replacements for the fonderie middleware functions — no adapt()
// needed. Import directly from this package instead of from the source
// packages, and use them as native Express middleware.
//
//   app.get('/jobs', requireAuth, withWorkspace(store), ...)

export const requireAuth = adapt(_requireAuth)

export function withWorkspace(
	store: Parameters<typeof _withWorkspace>[0],
) {
	return adapt(_withWorkspace(store))
}

export function requirePermission(
	operation:     Parameters<typeof _requirePermission>[0],
	permissionKey: Parameters<typeof _requirePermission>[1],
) {
	return adapt(_requirePermission(operation, permissionKey))
}

export function requireFeature(key: string) {
	return adapt(_requireFeature(key))
}

// ── mount ─────────────────────────────────────────────────────────
//
// Registers fonderie's infrastructure routes as an Express catch-all.
// Always call AFTER registering your own business routes.

export function mount(app: { all: (path: string, handler: (req: ExpressRequest, res: ExpressResponse) => void) => void }, fonderie: FonderieApp): void {
	app.all('*', async (req: ExpressRequest, res: ExpressResponse) => {
		const webReq = await expressRequestToWeb(req)
		const webRes = await fonderie.handle(webReq)
		await webResponseToExpress(webRes, res)
	})
}
